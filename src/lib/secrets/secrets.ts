import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq, desc } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { secrets, secretVersions } from "@/lib/db/schema";
import { encryptSecret, decryptSecret } from "@/lib/crypto/envelope";
import { writeAudit } from "@/lib/audit/audit";

type Db = NodePgDatabase<typeof schema>;
export type Secret = typeof secrets.$inferSelect;

export async function createSecret(
  db: Db, kek: Buffer,
  input: { environmentId: string; key: string; value: string; userId: string },
): Promise<Secret> {
  return db.transaction(async (tx) => {
    const [secret] = await tx.insert(secrets).values({
      environmentId: input.environmentId, key: input.key, createdBy: input.userId,
    }).returning();

    const enc = encryptSecret(input.value, kek, secret.id, 1);
    await tx.insert(secretVersions).values({ secretId: secret.id, version: 1, createdBy: input.userId, ...enc });

    await writeAudit(tx as unknown as Db, { actorId: input.userId, action: "secret.create", targetType: "secret", targetId: secret.id, metadata: { key: input.key } });
    return secret;
  });
}

async function latestVersionRow(db: Db, secretId: string) {
  const [row] = await db.select().from(secretVersions)
    .where(eq(secretVersions.secretId, secretId)).orderBy(desc(secretVersions.version)).limit(1);
  return row ?? null;
}

export async function getSecretValue(db: Db, kek: Buffer, secretId: string): Promise<string> {
  const row = await latestVersionRow(db, secretId);
  if (!row) throw new Error("Secret has no versions");
  return decryptSecret(row, kek, secretId, row.version);
}

export async function listSecrets(db: Db, environmentId: string) {
  const rows = await db.select().from(secrets).where(eq(secrets.environmentId, environmentId));
  const out = [];
  for (const s of rows) {
    const latest = await latestVersionRow(db, s.id);
    out.push({ id: s.id, key: s.key, needsRotation: s.needsRotation, latestVersion: latest?.version ?? 0 });
  }
  return out;
}

export async function rotateSecret(
  db: Db, kek: Buffer,
  input: { secretId: string; value: string; userId: string },
): Promise<{ version: number }> {
  return db.transaction(async (tx) => {
    const latest = await latestVersionRow(tx as unknown as Db, input.secretId);
    const nextVersion = (latest?.version ?? 0) + 1;

    const enc = encryptSecret(input.value, kek, input.secretId, nextVersion);
    await tx.insert(secretVersions).values({ secretId: input.secretId, version: nextVersion, createdBy: input.userId, ...enc });

    await tx.update(secrets)
      .set({ needsRotation: false, needsRotationReason: null, needsRotationAt: null })
      .where(eq(secrets.id, input.secretId));

    await writeAudit(tx as unknown as Db, { actorId: input.userId, action: "secret.rotate", targetType: "secret", targetId: input.secretId, metadata: { version: nextVersion } });
    return { version: nextVersion };
  });
}
