import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { runMigrations } from "@/lib/db/migrate";
import { resetDb, seedUser, testDb } from "../helpers/db";
import {
  createProject,
  createEnvironment,
  deleteEnvironment,
  deleteProject,
  listProjects,
  getEnvironments,
  getProject,
  listProjectsForUserWithCounts,
  listAllEnvironments,
} from "@/lib/projects/projects";
import * as schema from "@/lib/db/schema";

beforeAll(async () => { await runMigrations(); });
beforeEach(async () => { await resetDb(); });

describe("projects", () => {
  it("creates a project with dev/staging/prod environments by default", async () => {
    const u = await seedUser("alice@example.com");
    const { project, environments } = await createProject(testDb, { name: "My App", userId: u.id });
    expect(project.slug).toBe("my-app");
    expect(environments.map((e) => e.name).sort()).toEqual(["dev", "prod", "staging"]);
    expect(await getEnvironments(testDb, project.id)).toHaveLength(3);
    expect(await listProjects(testDb)).toHaveLength(1);
  });

  it("creates a project with a custom environment list", async () => {
    const u = await seedUser("erin@example.com");
    const { environments } = await createProject(testDb, {
      name: "Custom",
      userId: u.id,
      environments: ["dev", "preview", "prod", "dev"],
    });
    expect(environments.map((e) => e.name)).toEqual(["dev", "preview", "prod"]);
  });

  it("adds and removes environments on an existing project", async () => {
    const u = await seedUser("frank@example.com");
    const { project } = await createProject(testDb, {
      name: "Managed",
      userId: u.id,
      environments: ["dev"],
    });

    const created = await createEnvironment(testDb, {
      projectId: project.id,
      name: "staging",
      userId: u.id,
    });
    expect(created.name).toBe("staging");
    expect(await getEnvironments(testDb, project.id)).toHaveLength(2);

    const removed = await deleteEnvironment(testDb, { envId: created.id, userId: u.id });
    expect(removed?.id).toBe(created.id);
    expect((await getEnvironments(testDb, project.id)).map((e) => e.name)).toEqual(["dev"]);
  });

  it("deletes a project and cleans up its grants", async () => {
    const u = await seedUser("grace@example.com");
    const { project, environments } = await createProject(testDb, {
      name: "To Delete",
      userId: u.id,
      environments: ["dev"],
    });
    await testDb.insert(schema.grants).values([
      { userId: u.id, scopeType: "project", scopeId: project.id, role: "viewer" },
      { userId: u.id, scopeType: "environment", scopeId: environments[0].id, role: "member" },
    ]);

    const removed = await deleteProject(testDb, { projectId: project.id, userId: u.id });
    expect(removed?.id).toBe(project.id);
    expect(await getProject(testDb, project.id)).toBeUndefined();
    expect(await getEnvironments(testDb, project.id)).toHaveLength(0);

    const allGrants = await testDb.select().from(schema.grants);
    expect(allGrants.filter((g) => g.scopeId === project.id || g.scopeId === environments[0].id)).toHaveLength(0);
  });

  it("includes environment counts and only returns projects the user can access", async () => {
    const u = await seedUser("carol@example.com");
    const { project } = await createProject(testDb, { name: "Has Access", userId: u.id });
    await createProject(testDb, { name: "No Access", userId: u.id });
    await testDb.insert(schema.grants).values({ userId: u.id, scopeType: "project", scopeId: project.id, role: "viewer" });

    const rows = await listProjectsForUserWithCounts(testDb, u.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Has Access");
    expect(rows[0].environmentCount).toBe(3);
  });

  it("lists environments across all projects", async () => {
    const u = await seedUser("dave@example.com");
    await createProject(testDb, { name: "A", userId: u.id });
    await createProject(testDb, { name: "B", userId: u.id });
    const rows = await listAllEnvironments(testDb);
    expect(rows).toHaveLength(6); // 3 environments per project x 2 projects
  });
});
