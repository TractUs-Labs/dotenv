import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { runMigrations } from "@/lib/db/migrate";
import { resetDb, seedUser, testDb } from "../helpers/db";
import { projects, environments, grants } from "@/lib/db/schema";

vi.mock("@/lib/db/client", () => ({ getDb: () => testDb }));
const requireUserMock = vi.fn();
vi.mock("@/lib/auth/session", () => ({ requireUser: () => requireUserMock(), UnauthorizedError: class extends Error {} }));

beforeAll(async () => { await runMigrations(); });
beforeEach(async () => { await resetDb(); vi.clearAllMocks(); });

async function setup(role: "viewer" | "member") {
  const user = await seedUser("u@example.com");
  const [p] = await testDb.insert(projects).values({ name: "P", slug: "p" }).returning();
  const [e] = await testDb.insert(environments).values({ projectId: p.id, name: "dev" }).returning();
  await testDb.insert(grants).values({ userId: user.id, scopeType: "environment", scopeId: e.id, role });
  requireUserMock.mockResolvedValue({ id: user.id, email: user.email });
  return { user, e };
}

describe("secrets API", () => {
  it("member can create and read back a secret value", async () => {
    const { e } = await setup("member");
    const { POST: create } = await import("@/app/api/environments/[envId]/secrets/route");
    const createRes = await create(new Request("http://x", { method: "POST", body: JSON.stringify({ key: "K", value: "v1" }) }), { params: Promise.resolve({ envId: e.id }) });
    expect(createRes.status).toBe(201);
    const { secret } = await createRes.json();

    const { GET: getValue } = await import("@/app/api/secrets/[secretId]/value/route");
    const valRes = await getValue(new Request("http://x"), { params: Promise.resolve({ secretId: secret.id }) });
    expect((await valRes.json()).value).toBe("v1");
  });

  it("viewer cannot create a secret (403)", async () => {
    const { e } = await setup("viewer");
    const { POST: create } = await import("@/app/api/environments/[envId]/secrets/route");
    const res = await create(new Request("http://x", { method: "POST", body: JSON.stringify({ key: "K", value: "v1" }) }), { params: Promise.resolve({ envId: e.id }) });
    expect(res.status).toBe(403);
  });
});
