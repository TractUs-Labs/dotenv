import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { runMigrations } from "@/lib/db/migrate";
import { resetDb, seedUser, testDb } from "../helpers/db";
import { projects, environments, secrets, grants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

vi.mock("@/lib/db/client", () => ({ getDb: () => testDb }));
const requireUserMock = vi.fn();
vi.mock("@/lib/auth/session", () => ({ requireUser: () => requireUserMock(), UnauthorizedError: class extends Error {} }));

beforeAll(async () => { await runMigrations(); });
beforeEach(async () => { await resetDb(); vi.clearAllMocks(); });

describe("grants API", () => {
  it("admin revokes a user and the response lists flagged secrets", async () => {
    const admin = await seedUser("admin@example.com");
    await testDb.insert(grants).values({ userId: admin.id, scopeType: "org", scopeId: null, role: "admin" });
    const bob = await seedUser("bob@example.com");
    const [p] = await testDb.insert(projects).values({ name: "P", slug: "p" }).returning();
    const [e] = await testDb.insert(environments).values({ projectId: p.id, name: "dev" }).returning();
    await testDb.insert(secrets).values({ environmentId: e.id, key: "K" });
    await testDb.insert(grants).values({ userId: bob.id, scopeType: "project", scopeId: p.id, role: "member" });
    requireUserMock.mockResolvedValue({ id: admin.id, email: admin.email });

    const { DELETE } = await import("@/app/api/grants/route");
    const res = await DELETE(new Request("http://x", { method: "DELETE", body: JSON.stringify({ userId: bob.id, scopeType: "project", scopeId: p.id }) }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.revokedCount).toBe(1);
    expect(body.flaggedSecretIds).toHaveLength(1);
    expect(await testDb.select().from(grants).where(eq(grants.userId, bob.id))).toHaveLength(0);
  });

  it("member cannot manage grants (403)", async () => {
    const member = await seedUser("m@example.com");
    await testDb.insert(grants).values({ userId: member.id, scopeType: "org", scopeId: null, role: "member" });
    requireUserMock.mockResolvedValue({ id: member.id, email: member.email });
    const { POST } = await import("@/app/api/grants/route");
    const res = await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ userId: member.id, scopeType: "org", scopeId: null, role: "admin" }) }));
    expect(res.status).toBe(403);
  });
});
