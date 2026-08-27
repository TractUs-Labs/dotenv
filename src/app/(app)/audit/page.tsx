import { auth } from "@/lib/auth/auth";
import { redirect, notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { getOrgRole } from "@/lib/access/authorize";
import { roleAtLeast } from "@/lib/access/roles";
import { listAuditLog } from "@/lib/audit/audit";
import { AppEmptyState, AppPage, AppPageHeader } from "@/components/AppPage";
import { ScrollText } from "lucide-react";

function dotColor(action: string): string {
  if (action.includes("revoke") || action.includes("delete") || action.includes("remove"))
    return "bg-destructive";
  if (action.includes("create") || action.includes("rotate") || action.includes("grant"))
    return "bg-primary";
  return "bg-env-dev";
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
    "environment.delete": "deleted an environment",
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
    <AppPage narrow>
      <AppPageHeader
        title="Audit log"
        description={
          entries.length === 0
            ? "No events yet"
            : `Most recent ${entries.length} event${entries.length !== 1 ? "s" : ""}`
        }
      />

      {entries.length === 0 ? (
        <AppEmptyState
          icon={<ScrollText />}
          title="No activity yet"
          description="Secret views, grants, and project changes will show up here."
        />
      ) : (
        <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
          {entries.map((e) => {
            const { actor, verb } = actionSentence(e.action, e.actorEmail ?? null);
            const ts = e.createdAt.toISOString().replace("T", " ").slice(0, 19);
            return (
              <div
                key={e.id}
                className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-3 px-4 py-3 bg-card hover:bg-muted/20 transition-colors duration-150"
              >
                <time
                  dateTime={e.createdAt.toISOString()}
                  className="font-mono text-xs text-muted-foreground whitespace-nowrap sm:pt-0.5 sm:w-36 shrink-0 tabular-nums"
                >
                  {ts}
                </time>
                <span
                  className={`hidden sm:block mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${dotColor(e.action)}`}
                  aria-hidden
                />
                <p className="text-sm leading-snug min-w-0">
                  <span className="font-medium text-foreground">{actor}</span>{" "}
                  <span className="text-muted-foreground">{verb}</span>
                </p>
              </div>
            );
          })}
        </div>
      )}
    </AppPage>
  );
}
