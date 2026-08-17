import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { desc, eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { auditLog, users } from "@/lib/db/schema";

type Db = NodePgDatabase<typeof schema>;

export async function writeAudit(
  db: Db,
  entry: { actorId: string | null; action: string; targetType?: string; targetId?: string; metadata?: unknown },
): Promise<void> {
  await db.insert(auditLog).values({
    actorId: entry.actorId,
    action: entry.action,
    targetType: entry.targetType ?? null,
    targetId: entry.targetId ?? null,
    metadata: (entry.metadata ?? null) as never,
  });
}

export async function listAuditLog(
  db: Db,
  opts: { limit?: number } = {},
): Promise<Array<{
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: unknown;
  createdAt: Date;
  actorEmail: string | null;
}>> {
  const limit = opts.limit ?? 100;
  return db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      targetType: auditLog.targetType,
      targetId: auditLog.targetId,
      metadata: auditLog.metadata,
      createdAt: auditLog.createdAt,
      actorEmail: users.email,
    })
    .from(auditLog)
    .leftJoin(users, eq(auditLog.actorId, users.id))
    .orderBy(desc(auditLog.createdAt))
    .limit(limit);
}
