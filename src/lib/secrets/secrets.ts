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
  const [secret] = await db.insert(secrets).values({
    environmentId: input.environmentId, key: input.key, createdBy: input.userId,
  }).returning();

  const enc = encryptSecret(input.value, kek);
  await db.insert(secretVersions).values({ secretId: secret.id, version: 1, createdBy: input.userId, ...enc });

  await writeAudit(db, { actorId: input.userId, action: "secret.create", targetType: "secret", targetId: secret.id, metadata: { key: input.key } });
  return secret;
}

async function latestVersionRow(db: Db, secretId: string) {
  const [row] = await db.select().from(secretVersions)
    .where(eq(secretVersions.secretId, secretId)).orderBy(desc(secretVersions.version)).limit(1);
  return row ?? null;
}

export async function getSecretValue(db: Db, kek: Buffer, secretId: string): Promise<string> {
  const row = await latestVersionRow(db, secretId);
  if (!row) throw new Error("Secret has no versions");
  return decryptSecret(row, kek);
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
