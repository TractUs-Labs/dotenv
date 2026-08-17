import { auth } from "@/lib/auth/auth";
import { getDb } from "@/lib/db/client";
import { listProjectsForUserWithCounts } from "@/lib/projects/projects";
import { NewProjectDialog } from "@/components/NewProjectDialog";
import { FolderLock, ChevronRight, LayoutGrid } from "lucide-react";
import Link from "next/link";

export default async function Home() {
  const session = await auth();
  const userId = (session as unknown as { userId?: string }).userId!;
  const projects = await listProjectsForUserWithCounts(getDb(), userId);

  return (
    <main className="max-w-4xl w-full mx-auto px-8 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <LayoutGrid className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Projects</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {projects.length === 0 ? "No projects yet" : "Your projects"}
          </h1>
        </div>
        <NewProjectDialog />
      </div>

      {projects.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="rounded-panel border border-border overflow-hidden divide-y divide-border">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="flex items-center justify-between px-4 py-3 bg-card hover:bg-muted/30 transition-colors group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <FolderLock className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm font-medium text-foreground truncate">{p.name}</span>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <span className="text-xs text-muted-foreground font-mono">
                  {p.environmentCount} env{p.environmentCount !== 1 ? "s" : ""}
                </span>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center border border-border rounded-panel">
      <div className="w-14 h-14 rounded-lg bg-muted border border-border flex items-center justify-center mb-4">
        <FolderLock className="w-7 h-7 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1">No projects</h3>
      <p className="text-sm text-muted-foreground max-w-xs">
        Create a project to get started, or ask an admin to add you to one.
      </p>
    </div>
  );
}
