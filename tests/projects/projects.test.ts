import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { runMigrations } from "@/lib/db/migrate";
import { resetDb, seedUser, testDb } from "../helpers/db";
import { createProject, listProjects, getEnvironments } from "@/lib/projects/projects";

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
});
