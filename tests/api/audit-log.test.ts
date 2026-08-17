import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { runMigrations } from "@/lib/db/migrate";
import { resetDb, seedUser, testDb } from "../helpers/db";
import { grants } from "@/lib/db/schema";
import { writeAudit } from "@/lib/audit/audit";

vi.mock("@/lib/db/client", () => ({ getDb: () => testDb }));
const requireUserMock = vi.fn();
vi.mock("@/lib/auth/session", () => ({ requireUser: () => requireUserMock(), UnauthorizedError: class extends Error {} }));

beforeAll(async () => { await runMigrations(); });
beforeEach(async () => { await resetDb(); vi.clearAllMocks(); });

describe("audit-log API", () => {
  it("returns entries for an org admin", async () => {
    const admin = await seedUser("admin@example.com");
    await testDb.insert(grants).values({ userId: admin.id, scopeType: "org", scopeId: null, role: "admin" });
    await writeAudit(testDb, { actorId: admin.id, action: "project.create" });
    requireUserMock.mockResolvedValue({ id: admin.id, email: admin.email });

    const { GET } = await import("@/app/api/audit-log/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0].action).toBe("project.create");
  });

  it("returns 403 for a non-admin", async () => {
    const member = await seedUser("m@example.com");
    await testDb.insert(grants).values({ userId: member.id, scopeType: "org", scopeId: null, role: "member" });
    requireUserMock.mockResolvedValue({ id: member.id, email: member.email });

    const { GET } = await import("@/app/api/audit-log/route");
    const res = await GET();
    expect(res.status).toBe(403);
  });
});
