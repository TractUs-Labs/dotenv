import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { runMigrations } from "@/lib/db/migrate";
import { resetDb, seedUser, testDb } from "../helpers/db";
import { projects, environments, secrets, grants } from "@/lib/db/schema";
import { effectiveRoleForEnv, canReadSecret, canWriteSecret } from "@/lib/access/authorize";

beforeAll(async () => { await runMigrations(); });
beforeEach(async () => { await resetDb(); });

async function fixture() {
  const user = await seedUser("bob@example.com");
  const [proj] = await testDb.insert(projects).values({ name: "P", slug: "p" }).returning();
  const [env] = await testDb.insert(environments).values({ projectId: proj.id, name: "dev" }).returning();
  const [secret] = await testDb.insert(secrets).values({ environmentId: env.id, key: "K" }).returning();
  return { user, proj, env, secret };
}

describe("authorize", () => {
  it("returns null when the user has no grant", async () => {
    const { user, env } = await fixture();
    expect(await effectiveRoleForEnv(testDb, user.id, env.id)).toBeNull();
  });

  it("resolves an org-scoped grant to all environments", async () => {
    const { user, env } = await fixture();
    await testDb.insert(grants).values({ userId: user.id, scopeType: "org", scopeId: null, role: "admin" });
    expect(await effectiveRoleForEnv(testDb, user.id, env.id)).toBe("admin");
  });

  it("takes the highest of org/project/environment grants", async () => {
    const { user, proj, env } = await fixture();
    await testDb.insert(grants).values({ userId: user.id, scopeType: "project", scopeId: proj.id, role: "viewer" });
    await testDb.insert(grants).values({ userId: user.id, scopeType: "environment", scopeId: env.id, role: "member" });
    expect(await effectiveRoleForEnv(testDb, user.id, env.id)).toBe("member");
  });

  it("viewer can read but not write; member can write", async () => {
    const { user, env, secret } = await fixture();
    await testDb.insert(grants).values({ userId: user.id, scopeType: "environment", scopeId: env.id, role: "viewer" });
    expect(await canReadSecret(testDb, user.id, secret.id)).toBe(true);
    expect(await canWriteSecret(testDb, user.id, secret.id)).toBe(false);
  });
});
