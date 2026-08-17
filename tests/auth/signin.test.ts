import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { runMigrations } from "@/lib/db/migrate";
import { resetDb, testDb } from "../helpers/db";
import { users, grants } from "@/lib/db/schema";
import { handleSignIn } from "@/lib/auth/signin";
import { and, eq, isNull } from "drizzle-orm";

beforeAll(async () => { await runMigrations(); });
beforeEach(async () => { await resetDb(); });

const good = { email: "alice@example.com", email_verified: true, hd: "example.com", name: "Alice" };

describe("handleSignIn", () => {
  it("rejects a non-company domain", async () => {
    const r = await handleSignIn(testDb, { ...good, hd: "evil.com" }, "example.com");
    expect(r.ok).toBe(false);
    expect(await testDb.select().from(users)).toHaveLength(0);
  });

  it("rejects an unverified email", async () => {
    const r = await handleSignIn(testDb, { ...good, email_verified: false }, "example.com");
    expect(r.ok).toBe(false);
  });

  it("accepts a company user and upserts them", async () => {
    const r = await handleSignIn(testDb, good, "example.com");
    expect(r.ok).toBe(true);
    expect(r.userId).toBeTruthy();
    expect(await testDb.select().from(users)).toHaveLength(1);
  });

  it("bootstraps the first user as org owner, but not the second", async () => {
    await handleSignIn(testDb, good, "example.com");
    await handleSignIn(testDb, { ...good, email: "bob@example.com", name: "Bob" }, "example.com");
    const ownerGrants = await testDb.select().from(grants).where(and(eq(grants.scopeType, "org"), isNull(grants.scopeId), eq(grants.role, "owner")));
    expect(ownerGrants).toHaveLength(1);
  });

  it("is idempotent for the same user (no duplicate rows)", async () => {
    await handleSignIn(testDb, good, "example.com");
    await handleSignIn(testDb, good, "example.com");
    expect(await testDb.select().from(users)).toHaveLength(1);
  });
});
