import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { projects, environments } from "@/lib/db/schema";
import { writeAudit } from "@/lib/audit/audit";

type Db = NodePgDatabase<typeof schema>;
export type Project = typeof projects.$inferSelect;
export type Environment = typeof environments.$inferSelect;

const ENV_NAMES = ["dev", "staging", "prod"] as const;

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export async function createProject(db: Db, input: { name: string; userId: string }): Promise<{ project: Project; environments: Environment[] }> {
  const [project] = await db.insert(projects).values({
    name: input.name, slug: slugify(input.name), createdBy: input.userId,
  }).returning();

  const envs = await db.insert(environments)
    .values(ENV_NAMES.map((name) => ({ projectId: project.id, name })))
    .returning();

  await writeAudit(db, { actorId: input.userId, action: "project.create", targetType: "project", targetId: project.id, metadata: { name: input.name } });
  return { project, environments: envs };
}

export async function listProjects(db: Db): Promise<Project[]> {
  return db.select().from(projects);
}

export async function getEnvironments(db: Db, projectId: string): Promise<Environment[]> {
  return db.select().from(environments).where(eq(environments.projectId, projectId));
}
