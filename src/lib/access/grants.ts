import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { and, eq, inArray, isNull } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { environments, grants, secrets, users } from "@/lib/db/schema";
import { Role } from "./roles";
import { writeAudit } from "@/lib/audit/audit";

type Db = NodePgDatabase<typeof schema>;
export type Grant = typeof grants.$inferSelect;
export type Scope = { scopeType: "org" | "project" | "environment"; scopeId: string | null };

function scopeMatch(userId: string, scope: Scope) {
  return and(
    eq(grants.userId, userId),
    eq(grants.scopeType, scope.scopeType),
    scope.scopeId === null ? isNull(grants.scopeId) : eq(grants.scopeId, scope.scopeId),
  );
}

export async function grantAccess(
  db: Db,
  input: { granterId: string; userId: string; scope: Scope; role: Role },
): Promise<Grant> {
  const existing = await db.select().from(grants).where(scopeMatch(input.userId, input.scope));

  let result: Grant;
  if (existing.length > 0) {
    const [updated] = await db.update(grants).set({ role: input.role, grantedBy: input.granterId })
      .where(eq(grants.id, existing[0].id)).returning();
    result = updated;
  } else {
    const [created] = await db.insert(grants).values({
      userId: input.userId, scopeType: input.scope.scopeType, scopeId: input.scope.scopeId,
      role: input.role, grantedBy: input.granterId,
    }).returning();
    result = created;
  }

  await writeAudit(db, {
    actorId: input.granterId, action: "grant.create", targetType: "user", targetId: input.userId,
    metadata: { scope: input.scope, role: input.role },
  });
  return result;
}

async function affectedEnvironmentIds(db: Db, scope: Scope): Promise<string[]> {
  if (scope.scopeType === "org") {
    return (await db.select({ id: environments.id }).from(environments)).map((e) => e.id);
  }
  if (scope.scopeType === "project") {
    return (await db.select({ id: environments.id }).from(environments).where(eq(environments.projectId, scope.scopeId!))).map((e) => e.id);
  }
  return [scope.scopeId!];
}

export async function revokeAccess(
  db: Db,
  input: { revokerId: string; userId: string; scope: Scope },
): Promise<{ revokedCount: number; flaggedSecretIds: string[] }> {
  const deleted = await db.delete(grants).where(scopeMatch(input.userId, input.scope)).returning();

  const envIds = await affectedEnvironmentIds(db, input.scope);
  let flaggedSecretIds: string[] = [];
  if (envIds.length > 0) {
    const flagged = await db.update(secrets)
      .set({ needsRotation: true, needsRotationReason: "access_revoked", needsRotationAt: new Date() })
      .where(inArray(secrets.environmentId, envIds))
      .returning({ id: secrets.id });
    flaggedSecretIds = flagged.map((s) => s.id);
  }

  await writeAudit(db, {
    actorId: input.revokerId, action: "access.revoke", targetType: "user", targetId: input.userId,
    metadata: { scope: input.scope, flaggedSecretIds },
  });

  return { revokedCount: deleted.length, flaggedSecretIds };
}

export async function listUsersWithAccess(db: Db) {
  const allUsers = await db.select().from(users);
  const allGrants = await db.select().from(grants);
  return allUsers.map((user) => ({ user, grants: allGrants.filter((g) => g.userId === user.id) }));
}
