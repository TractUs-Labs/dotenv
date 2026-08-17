import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { and, eq, inArray, isNull } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { projects, environments, grants } from "@/lib/db/schema";
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

export async function listProjectsForUser(db: Db, userId: string): Promise<Project[]> {
  // Check for org-scoped grant (gives access to all projects)
  const orgGrant = await db.select({ id: grants.id }).from(grants)
    .where(and(eq(grants.userId, userId), eq(grants.scopeType, "org"), isNull(grants.scopeId)))
    .limit(1);

  if (orgGrant.length > 0) {
    return db.select().from(projects);
  }

  // Get projects via project-scoped grants
  const projectGrants = await db.select({ scopeId: grants.scopeId }).from(grants)
    .where(and(eq(grants.userId, userId), eq(grants.scopeType, "project")));

  // Get projects via environment-scoped grants
  const envGrants = await db.select({ scopeId: grants.scopeId }).from(grants)
    .where(and(eq(grants.userId, userId), eq(grants.scopeType, "environment")));

  const projectIds = new Set<string>(projectGrants.map((g) => g.scopeId!).filter(Boolean));

  if (envGrants.length > 0) {
    const envIds = envGrants.map((g) => g.scopeId!).filter(Boolean);
    const envProjectRows = await db.select({ projectId: environments.projectId }).from(environments)
      .where(inArray(environments.id, envIds));
    for (const e of envProjectRows) {
      projectIds.add(e.projectId);
    }
  }

  const pids = [...projectIds];
  if (pids.length === 0) return [];
  return db.select().from(projects).where(inArray(projects.id, pids));
}

export async function getEnvironments(db: Db, projectId: string): Promise<Environment[]> {
  return db.select().from(environments).where(eq(environments.projectId, projectId));
}

export async function getProject(db: Db, projectId: string): Promise<Project | undefined> {
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  return project;
}
