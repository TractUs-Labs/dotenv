import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { runMigrations } from "@/lib/db/migrate";
import { resetDb, seedUser, testDb } from "../helpers/db";
import { grants } from "@/lib/db/schema";
import { createProject } from "@/lib/projects/projects";

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
    expect(body.environments.map((e: { name: string }) => e.name).sort()).toEqual(["dev", "prod", "staging"]);
  });

  it("creates a project with custom environments", async () => {
    const admin = await seedUser("admin2@example.com");
    await testDb.insert(grants).values({ userId: admin.id, scopeType: "org", scopeId: null, role: "admin" });
    requireUserMock.mockResolvedValue({ id: admin.id, email: admin.email });

    const { POST } = await import("@/app/api/projects/route");
    const res = await POST(new Request("http://x/api/projects", {
      method: "POST",
      body: JSON.stringify({ name: "Custom", environments: ["dev", "preview"] }),
    }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.environments.map((e: { name: string }) => e.name)).toEqual(["dev", "preview"]);
  });

  it("returns 403 for a viewer", async () => {
    const viewer = await seedUser("v@example.com");
    await testDb.insert(grants).values({ userId: viewer.id, scopeType: "org", scopeId: null, role: "viewer" });
    requireUserMock.mockResolvedValue({ id: viewer.id, email: viewer.email });

    const { POST } = await import("@/app/api/projects/route");
    const res = await POST(new Request("http://x/api/projects", { method: "POST", body: JSON.stringify({ name: "Nope" }) }));
    expect(res.status).toBe(403);
  });

  it("creates and deletes environments for an org admin", async () => {
    const admin = await seedUser("envadmin@example.com");
    await testDb.insert(grants).values({ userId: admin.id, scopeType: "org", scopeId: null, role: "admin" });
    requireUserMock.mockResolvedValue({ id: admin.id, email: admin.email });

    const { project } = await createProject(testDb, {
      name: "Env Project",
      userId: admin.id,
      environments: ["dev"],
    });

    const { POST } = await import("@/app/api/projects/[projectId]/environments/route");
    const createRes = await POST(
      new Request(`http://x/api/projects/${project.id}/environments`, {
        method: "POST",
        body: JSON.stringify({ name: "staging" }),
      }),
      { params: Promise.resolve({ projectId: project.id }) },
    );
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.environment.name).toBe("staging");

    const { DELETE } = await import("@/app/api/environments/[envId]/route");
    const deleteRes = await DELETE(
      new Request(`http://x/api/environments/${created.environment.id}`, { method: "DELETE" }),
      { params: Promise.resolve({ envId: created.environment.id }) },
    );
    expect(deleteRes.status).toBe(200);
  });

  it("deletes a project when the user is an org owner", async () => {
    const owner = await seedUser("owner@example.com");
    await testDb.insert(grants).values({ userId: owner.id, scopeType: "org", scopeId: null, role: "owner" });
    requireUserMock.mockResolvedValue({ id: owner.id, email: owner.email });

    const { project } = await createProject(testDb, {
      name: "Delete Me",
      userId: owner.id,
      environments: ["dev"],
    });

    const { DELETE } = await import("@/app/api/projects/[projectId]/route");
    const res = await DELETE(
      new Request(`http://x/api/projects/${project.id}`, { method: "DELETE" }),
      { params: Promise.resolve({ projectId: project.id }) },
    );
    expect(res.status).toBe(200);
  });

  it("returns 403 when an admin tries to delete a project", async () => {
    const admin = await seedUser("admin-del@example.com");
    await testDb.insert(grants).values({ userId: admin.id, scopeType: "org", scopeId: null, role: "admin" });
    requireUserMock.mockResolvedValue({ id: admin.id, email: admin.email });

    const { project } = await createProject(testDb, {
      name: "Protected",
      userId: admin.id,
      environments: ["dev"],
    });

    const { DELETE } = await import("@/app/api/projects/[projectId]/route");
    const res = await DELETE(
      new Request(`http://x/api/projects/${project.id}`, { method: "DELETE" }),
      { params: Promise.resolve({ projectId: project.id }) },
    );
    expect(res.status).toBe(403);
  });
});
