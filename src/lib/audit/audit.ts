import { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@/lib/db/schema";
import { auditLog } from "@/lib/db/schema";

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
