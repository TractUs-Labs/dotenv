import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { runMigrations } from "@/lib/db/migrate";
import { resetDb, seedUser, testDb } from "../helpers/db";
import { createProject, listProjects, getEnvironments, listProjectsForUserWithCounts, listAllEnvironments } from "@/lib/projects/projects";
import * as schema from "@/lib/db/schema";

beforeAll(async () => { await runMigrations(); });
beforeEach(async () => { await resetDb(); });

describe("projects", () => {
  it("creates a project with dev/staging/prod environments", async () => {
    const u = await seedUser("alice@example.com");
    const { project, environments } = await createProject(testDb, { name: "My App", userId: u.id });
    expect(project.slug).toBe("my-app");
    expect(environments.map((e) => e.name).sort()).toEqual(["dev", "prod", "staging"]);
    expect(await getEnvironments(testDb, project.id)).toHaveLength(3);
    expect(await listProjects(testDb)).toHaveLength(1);
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
