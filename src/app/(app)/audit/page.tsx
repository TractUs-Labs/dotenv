import { auth } from "@/lib/auth/auth";
import { redirect, notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { getOrgRole } from "@/lib/access/authorize";
import { roleAtLeast } from "@/lib/access/roles";
import { listAuditLog } from "@/lib/audit/audit";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function AuditLogPage() {
  const session = await auth();
  const userId = (session as unknown as { userId?: string } | null)?.userId;
  if (!userId) redirect("/signin");

  const db = getDb();
  const role = await getOrgRole(db, userId);
  if (!role || !roleAtLeast(role, "admin")) notFound();

  const entries = await listAuditLog(db);

  return (
    <main className="max-w-4xl w-full mx-auto px-8 py-10">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <span className="text-xs font-medium uppercase tracking-wider">Audit</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Audit log</h1>
        <p className="text-sm text-muted-foreground mt-1">Most recent {entries.length} events.</p>
      </div>

      {entries.length === 0 ? (
        <div className="py-20 text-center border border-border rounded-panel">
          <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
        </div>
      ) : (
        <div className="border border-border rounded-panel overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                    {e.createdAt.toISOString().replace("T", " ").slice(0, 19)}
                  </TableCell>
                  <TableCell className="text-sm text-foreground">{e.actorEmail ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs text-foreground">{e.action}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {e.targetType ? `${e.targetType}:${e.targetId?.slice(0, 8)}` : "—"}
                  </TableCell>
                  <TableCell>
                    {e.metadata ? (
                      <details>
                        <summary className="cursor-pointer text-xs text-primary select-none">view</summary>
                        <pre className="mt-1 text-[10px] font-mono text-muted-foreground bg-muted/40 border border-border rounded-lg p-2 max-w-xs overflow-x-auto">
                          {JSON.stringify(e.metadata, null, 2)}
                        </pre>
                      </details>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </main>
  );
}
