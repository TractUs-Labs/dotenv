import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { runMigrations } from "@/lib/db/migrate";
import { resetDb, seedUser, testDb } from "../helpers/db";
import { grants } from "@/lib/db/schema";
import { grantAccess } from "@/lib/access/grants";
import { eq } from "drizzle-orm";

beforeAll(async () => { await runMigrations(); });
beforeEach(async () => { await resetDb(); });

describe("grantAccess", () => {
  it("creates a grant", async () => {
    const admin = await seedUser("admin@example.com");
    const bob = await seedUser("bob@example.com");
    const g = await grantAccess(testDb, { granterId: admin.id, userId: bob.id, scope: { scopeType: "org", scopeId: null }, role: "member" });
    expect(g.role).toBe("member");
  });

  it("upserts — re-granting the same scope updates the role, no duplicate row", async () => {
    const admin = await seedUser("admin@example.com");
    const bob = await seedUser("bob@example.com");
    await grantAccess(testDb, { granterId: admin.id, userId: bob.id, scope: { scopeType: "org", scopeId: null }, role: "viewer" });
    await grantAccess(testDb, { granterId: admin.id, userId: bob.id, scope: { scopeType: "org", scopeId: null }, role: "admin" });
    const rows = await testDb.select().from(grants).where(eq(grants.userId, bob.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].role).toBe("admin");
  });
});
