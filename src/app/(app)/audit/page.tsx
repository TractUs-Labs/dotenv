import { auth } from "@/lib/auth/auth";
import { redirect, notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { getOrgRole } from "@/lib/access/authorize";
import { roleAtLeast } from "@/lib/access/roles";
import { listAuditLog } from "@/lib/audit/audit";

function dotColor(action: string): string {
  if (action.includes("revoke") || action.includes("delete") || action.includes("remove"))
    return "bg-destructive";
  if (action.includes("create") || action.includes("rotate") || action.includes("grant"))
    return "bg-primary";
  return "bg-env-dev"; // read/view/list — green
}

function actionSentence(action: string, actorEmail: string | null): { actor: string; verb: string } {
  const actor = actorEmail ?? "System";
  const map: Record<string, string> = {
    "secret.create": "added a secret",
    "secret.rotate": "rotated a secret",
    "secret.view": "viewed a secret",
    "secret.delete": "deleted a secret",
    "grant.create": "granted access",
    "grant.revoke": "revoked access",
    "project.create": "created a project",
    "project.delete": "deleted a project",
    "environment.create": "created an environment",
  };
  return { actor, verb: map[action] ?? action };
}

export default async function AuditLogPage() {
  const session = await auth();
  const userId = (session as unknown as { userId?: string } | null)?.userId;
  if (!userId) redirect("/signin");

  const db = getDb();
  const role = await getOrgRole(db, userId);
  if (!role || !roleAtLeast(role, "admin")) notFound();

  const entries = await listAuditLog(db);

  return (
    <main className="max-w-3xl w-full mx-auto px-8 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Audit log</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Most recent {entries.length} event{entries.length !== 1 ? "s" : ""}
        </p>
      </div>

      {entries.length === 0 ? (
        <div className="py-20 text-center border border-border rounded-xl">
          <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
        </div>
      ) : (
        <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
          {entries.map((e) => {
            const { actor, verb } = actionSentence(e.action, e.actorEmail ?? null);
            const ts = e.createdAt.toISOString().replace("T", " ").slice(0, 19);
            return (
              <div key={e.id} className="flex items-start gap-3 px-4 py-3 bg-card hover:bg-muted/20 transition-colors">
                <span className="font-mono text-xs text-muted-foreground whitespace-nowrap pt-0.5 w-36 shrink-0">
                  {ts}
                </span>
                <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${dotColor(e.action)}`} />
                <p className="text-sm leading-snug">
                  <span className="font-medium text-foreground">{actor}</span>{" "}
                  <span className="text-muted-foreground">{verb}</span>
                </p>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
