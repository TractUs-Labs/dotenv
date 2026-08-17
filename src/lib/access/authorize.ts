import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { and, eq, or, isNull } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { grants, environments, secrets } from "@/lib/db/schema";
import { Role, highestRole, roleAtLeast } from "./roles";

type Db = NodePgDatabase<typeof schema>;

export async function effectiveRoleForEnv(db: Db, userId: string, environmentId: string): Promise<Role | null> {
  const [env] = await db.select().from(environments).where(eq(environments.id, environmentId));
  if (!env) return null;

  const rows = await db.select({ scopeType: grants.scopeType, scopeId: grants.scopeId, role: grants.role })
    .from(grants)
    .where(and(
      eq(grants.userId, userId),
      or(
        and(eq(grants.scopeType, "org"), isNull(grants.scopeId)),
        and(eq(grants.scopeType, "project"), eq(grants.scopeId, env.projectId)),
        and(eq(grants.scopeType, "environment"), eq(grants.scopeId, environmentId)),
      ),
    ));

  return highestRole(rows.map((r) => r.role as Role));
}

async function envIdForSecret(db: Db, secretId: string): Promise<string | null> {
  const [s] = await db.select({ environmentId: secrets.environmentId }).from(secrets).where(eq(secrets.id, secretId));
  return s?.environmentId ?? null;
}

export async function canReadSecret(db: Db, userId: string, secretId: string): Promise<boolean> {
  const envId = await envIdForSecret(db, secretId);
  if (!envId) return false;
  const role = await effectiveRoleForEnv(db, userId, envId);
  return role !== null && roleAtLeast(role, "viewer");
}

export async function canWriteSecret(db: Db, userId: string, secretId: string): Promise<boolean> {
  const envId = await envIdForSecret(db, secretId);
  if (!envId) return false;
  const role = await effectiveRoleForEnv(db, userId, envId);
  return role !== null && roleAtLeast(role, "member");
}

export async function canManageGrantsForEnv(db: Db, userId: string, environmentId: string): Promise<boolean> {
  const role = await effectiveRoleForEnv(db, userId, environmentId);
  return role !== null && roleAtLeast(role, "admin");
}
