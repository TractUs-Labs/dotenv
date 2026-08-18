import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { listProjectsForUserWithCounts, getEnvironments } from "@/lib/projects/projects";
import { NewProjectDialog } from "@/components/NewProjectDialog";
import { FolderLock } from "lucide-react";
import Link from "next/link";

type Environment = { id: string; name: string };

function envChipClass(name: string): string {
  const lower = name.toLowerCase();
  if (lower === "prod" || lower === "production") return "bg-env-prod-bg text-env-prod";
  if (lower === "staging") return "bg-env-staging-bg text-env-staging";
  return "bg-env-dev-bg text-env-dev"; // dev + anything else
}

export default async function Home() {
  const session = await auth();
  const userId = (session as unknown as { userId?: string } | null)?.userId;
  if (!userId) redirect("/signin");

  const db = getDb();
  const projects = await listProjectsForUserWithCounts(db, userId);
  const projectEnvs: Environment[][] = await Promise.all(
    projects.map((p) => getEnvironments(db, p.id))
  );

  return (
    <main className="max-w-5xl w-full mx-auto px-8 py-10">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Projects</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {projects.length === 0
              ? "No projects yet"
              : `${projects.length} project${projects.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <NewProjectDialog />
      </div>

      {projects.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map((p, i) => (
            <ProjectCard key={p.id} project={p} envs={projectEnvs[i] ?? []} />
          ))}
        </div>
      )}
    </main>
  );
}

function ProjectCard({
  project,
  envs,
}: {
  project: { id: string; name: string; environmentCount: number };
  envs: Environment[];
}) {
  return (
    <Link
      href={`/projects/${project.id}`}
      className="group block rounded-xl border border-border bg-card p-5 hover:border-primary/30 transition-colors"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <span className="font-medium text-foreground group-hover:text-primary transition-colors">
          {project.name}
        </span>
        <span className="font-mono text-xs text-muted-foreground shrink-0 tabular-nums">
          {project.environmentCount} env{project.environmentCount !== 1 ? "s" : ""}
        </span>
      </div>

      {envs.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {envs.map((e) => (
            <span
              key={e.id}
              className={`inline-flex items-center rounded-md px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${envChipClass(e.name)}`}
            >
              {e.name}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center border border-border rounded-xl">
      <FolderLock className="w-8 h-8 text-muted-foreground mb-3" />
      <h3 className="text-base font-semibold text-foreground mb-1">No projects</h3>
      <p className="text-sm text-muted-foreground max-w-xs">
        Create a project to get started, or ask an admin to add you to one.
      </p>
    </div>
  );
}
