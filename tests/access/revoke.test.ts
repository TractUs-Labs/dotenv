import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { runMigrations } from "@/lib/db/migrate";
import { resetDb, seedUser, testDb } from "../helpers/db";
import { projects, environments, secrets, grants, auditLog } from "@/lib/db/schema";
import { grantAccess, revokeAccess } from "@/lib/access/grants";
import { eq } from "drizzle-orm";

beforeAll(async () => { await runMigrations(); });
beforeEach(async () => { await resetDb(); });

async function fixture() {
  const admin = await seedUser("admin@example.com");
  const bob = await seedUser("bob@example.com");
  const [proj] = await testDb.insert(projects).values({ name: "P", slug: "p" }).returning();
  const [dev] = await testDb.insert(environments).values({ projectId: proj.id, name: "dev" }).returning();
  const [prod] = await testDb.insert(environments).values({ projectId: proj.id, name: "prod" }).returning();
  const [s1] = await testDb.insert(secrets).values({ environmentId: dev.id, key: "A" }).returning();
  const [s2] = await testDb.insert(secrets).values({ environmentId: prod.id, key: "B" }).returning();
  return { admin, bob, proj, dev, prod, s1, s2 };
}

describe("revokeAccess", () => {
  it("removes the grant and flags all in-scope secrets for the project scope", async () => {
    const { admin, bob, proj, s1, s2 } = await fixture();
    await grantAccess(testDb, { granterId: admin.id, userId: bob.id, scope: { scopeType: "project", scopeId: proj.id }, role: "member" });

    const result = await revokeAccess(testDb, { revokerId: admin.id, userId: bob.id, scope: { scopeType: "project", scopeId: proj.id } });

    expect(result.revokedCount).toBe(1);
    expect(result.flaggedSecretIds.sort()).toEqual([s1.id, s2.id].sort());
    expect(await testDb.select().from(grants).where(eq(grants.userId, bob.id))).toHaveLength(0);
    const flagged = await testDb.select().from(secrets).where(eq(secrets.needsRotation, true));
    expect(flagged).toHaveLength(2);
    expect(flagged[0].needsRotationReason).toBe("access_revoked");
  });

  it("flags only the one environment for an environment-scoped revoke", async () => {
    const { admin, bob, dev, s1 } = await fixture();
    await grantAccess(testDb, { granterId: admin.id, userId: bob.id, scope: { scopeType: "environment", scopeId: dev.id }, role: "member" });
    const result = await revokeAccess(testDb, { revokerId: admin.id, userId: bob.id, scope: { scopeType: "environment", scopeId: dev.id } });
    expect(result.flaggedSecretIds).toEqual([s1.id]);
  });

  it("writes an audit entry with the flagged secret ids", async () => {
    const { admin, bob, proj } = await fixture();
    await grantAccess(testDb, { granterId: admin.id, userId: bob.id, scope: { scopeType: "project", scopeId: proj.id }, role: "member" });
    await revokeAccess(testDb, { revokerId: admin.id, userId: bob.id, scope: { scopeType: "project", scopeId: proj.id } });
    const entries = (await testDb.select().from(auditLog)).filter((e) => e.action === "access.revoke");
    expect(entries).toHaveLength(1);
    expect((entries[0].metadata as { flaggedSecretIds: string[] }).flaggedSecretIds).toHaveLength(2);
  });
});
