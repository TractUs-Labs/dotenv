import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { runMigrations } from "@/lib/db/migrate";
import { resetDb, seedUser, testDb } from "../helpers/db";
import { projects, environments, secrets } from "@/lib/db/schema";
import { loadKek } from "@/lib/crypto/kek";
import { createSecret, rotateSecret, getSecretValue } from "@/lib/secrets/secrets";
import { eq } from "drizzle-orm";

const kek = loadKek(process.env.KEK_FILE!);
beforeAll(async () => { await runMigrations(); });
beforeEach(async () => { await resetDb(); });

describe("rotateSecret", () => {
  it("appends a new version and returns the newest value", async () => {
    const u = await seedUser("alice@example.com");
    const [p] = await testDb.insert(projects).values({ name: "P", slug: "p" }).returning();
    const [e] = await testDb.insert(environments).values({ projectId: p.id, name: "dev" }).returning();
    const s = await createSecret(testDb, kek, { environmentId: e.id, key: "K", value: "v1", userId: u.id });

    const { version } = await rotateSecret(testDb, kek, { secretId: s.id, value: "v2", userId: u.id });

    expect(version).toBe(2);
    expect(await getSecretValue(testDb, kek, s.id)).toBe("v2");
  });

  it("clears the needs_rotation flag", async () => {
    const u = await seedUser("alice@example.com");
    const [p] = await testDb.insert(projects).values({ name: "P", slug: "p" }).returning();
    const [e] = await testDb.insert(environments).values({ projectId: p.id, name: "dev" }).returning();
    const s = await createSecret(testDb, kek, { environmentId: e.id, key: "K", value: "v1", userId: u.id });
    await testDb.update(secrets).set({ needsRotation: true, needsRotationReason: "access_revoked" }).where(eq(secrets.id, s.id));

    await rotateSecret(testDb, kek, { secretId: s.id, value: "v2", userId: u.id });

    const [after] = await testDb.select().from(secrets).where(eq(secrets.id, s.id));
    expect(after.needsRotation).toBe(false);
    expect(after.needsRotationReason).toBeNull();
  });
});
