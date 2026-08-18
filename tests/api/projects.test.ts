import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { runMigrations } from "@/lib/db/migrate";
import { resetDb, seedUser, testDb } from "../helpers/db";
import { grants } from "@/lib/db/schema";

vi.mock("@/lib/db/client", () => ({ getDb: () => testDb }));
const requireUserMock = vi.fn();
vi.mock("@/lib/auth/session", () => ({ requireUser: () => requireUserMock(), UnauthorizedError: class extends Error {} }));

beforeAll(async () => { await runMigrations(); });
beforeEach(async () => { await resetDb(); vi.clearAllMocks(); });

describe("projects API", () => {
  it("creates a project when the user is an org admin", async () => {
    const admin = await seedUser("admin@example.com");
    await testDb.insert(grants).values({ userId: admin.id, scopeType: "org", scopeId: null, role: "admin" });
    requireUserMock.mockResolvedValue({ id: admin.id, email: admin.email });

    const { POST } = await import("@/app/api/projects/route");
    const res = await POST(new Request("http://x/api/projects", { method: "POST", body: JSON.stringify({ name: "My App" }) }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.project.slug).toBe("my-app");
  });

  it("returns 403 for a viewer", async () => {
    const viewer = await seedUser("v@example.com");
    await testDb.insert(grants).values({ userId: viewer.id, scopeType: "org", scopeId: null, role: "viewer" });
    requireUserMock.mockResolvedValue({ id: viewer.id, email: viewer.email });

    const { POST } = await import("@/app/api/projects/route");
    const res = await POST(new Request("http://x/api/projects", { method: "POST", body: JSON.stringify({ name: "Nope" }) }));
    expect(res.status).toBe(403);
  });
});
