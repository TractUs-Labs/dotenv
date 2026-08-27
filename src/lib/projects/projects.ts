import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { and, count, eq, inArray, isNull } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { projects, environments, grants } from "@/lib/db/schema";
import { writeAudit } from "@/lib/audit/audit";

type Db = NodePgDatabase<typeof schema>;
export type Project = typeof projects.$inferSelect;
export type Environment = typeof environments.$inferSelect;

export const DEFAULT_ENV_NAMES = ["dev", "staging", "prod"] as const;

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function normalizeEnvNames(names: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(name);
  }
  return result;
}

export async function createProject(
  db: Db,
  input: { name: string; userId: string; environments?: string[] },
): Promise<{ project: Project; environments: Environment[] }> {
  const envNames = normalizeEnvNames(input.environments ?? [...DEFAULT_ENV_NAMES]);
  if (envNames.length === 0) {
    throw new Error("at least one environment is required");
  }

  const [project] = await db.insert(projects).values({
    name: input.name, slug: slugify(input.name), createdBy: input.userId,
  }).returning();

  const envs = await db.insert(environments)
    .values(envNames.map((name) => ({ projectId: project.id, name })))
    .returning();

  await writeAudit(db, { actorId: input.userId, action: "project.create", targetType: "project", targetId: project.id, metadata: { name: input.name } });
  return { project, environments: envs };
}

export async function createEnvironment(
  db: Db,
  input: { projectId: string; name: string; userId: string },
): Promise<Environment> {
  const name = input.name.trim();
  if (!name) throw new Error("environment name is required");

  const [env] = await db.insert(environments)
    .values({ projectId: input.projectId, name })
    .returning();

  await writeAudit(db, {
    actorId: input.userId,
    action: "environment.create",
    targetType: "environment",
    targetId: env.id,
    metadata: { name, projectId: input.projectId },
  });
  return env;
}

export async function deleteEnvironment(
  db: Db,
  input: { envId: string; userId: string },
): Promise<Environment | undefined> {
  const [env] = await db.select().from(environments).where(eq(environments.id, input.envId)).limit(1);
  if (!env) return undefined;

  await db.delete(environments).where(eq(environments.id, input.envId));
  await writeAudit(db, {
    actorId: input.userId,
    action: "environment.delete",
    targetType: "environment",
    targetId: env.id,
    metadata: { name: env.name, projectId: env.projectId },
  });
  return env;
}

export async function deleteProject(
  db: Db,
  input: { projectId: string; userId: string },
): Promise<Project | undefined> {
  const project = await getProject(db, input.projectId);
  if (!project) return undefined;

  const envs = await getEnvironments(db, input.projectId);
  const envIds = envs.map((e) => e.id);

  await writeAudit(db, {
    actorId: input.userId,
    action: "project.delete",
    targetType: "project",
    targetId: project.id,
    metadata: { name: project.name },
  });

  if (envIds.length > 0) {
    await db.delete(grants).where(
      and(eq(grants.scopeType, "environment"), inArray(grants.scopeId, envIds)),
    );
  }
  await db.delete(grants).where(
    and(eq(grants.scopeType, "project"), eq(grants.scopeId, input.projectId)),
  );
  await db.delete(projects).where(eq(projects.id, input.projectId));
  return project;
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

export async function listProjectsForUserWithCounts(
  db: Db,
  userId: string,
): Promise<Array<Project & { environmentCount: number }>> {
  const base = await listProjectsForUser(db, userId);
  if (base.length === 0) return [];
  const ids = base.map((p) => p.id);
  const counts = await db
    .select({ projectId: environments.projectId, count: count() })
    .from(environments)
    .where(inArray(environments.projectId, ids))
    .groupBy(environments.projectId);
  const countMap = new Map(counts.map((c) => [c.projectId, Number(c.count)]));
  return base.map((p) => ({ ...p, environmentCount: countMap.get(p.id) ?? 0 }));
}

export async function getEnvironments(db: Db, projectId: string): Promise<Environment[]> {
  return db.select().from(environments).where(eq(environments.projectId, projectId));
}

export async function listAllEnvironments(db: Db): Promise<Environment[]> {
  return db.select().from(environments);
}

export async function getProject(db: Db, projectId: string): Promise<Project | undefined> {
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  return project;
}
