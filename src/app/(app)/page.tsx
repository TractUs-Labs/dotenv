import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { listProjectsForUserWithCounts, getEnvironments } from "@/lib/projects/projects";
import { NewProjectDialog } from "@/components/NewProjectDialog";
import { AppEmptyState, AppPage, AppPageHeader } from "@/components/AppPage";
import { FolderLock } from "lucide-react";
import Link from "next/link";

type Environment = { id: string; name: string };

function envChipClass(name: string): string {
  const lower = name.toLowerCase();
  if (lower === "prod" || lower === "production") return "bg-env-prod-bg text-env-prod";
  if (lower === "staging") return "bg-env-staging-bg text-env-staging";
  return "bg-env-dev-bg text-env-dev";
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
    <AppPage>
      <AppPageHeader
        title="Projects"
        description={
          projects.length === 0
            ? "No projects yet"
            : `${projects.length} project${projects.length !== 1 ? "s" : ""}`
        }
        actions={<NewProjectDialog />}
      />

      {projects.length === 0 ? (
        <AppEmptyState
          icon={<FolderLock />}
          title="No projects"
          description="Create a project to get started, or ask an admin to add you to one."
          action={<NewProjectDialog />}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {projects.map((p, i) => (
            <ProjectCard key={p.id} project={p} envs={projectEnvs[i] ?? []} />
          ))}
        </div>
      )}
    </AppPage>
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
      className="group block rounded-xl border border-border bg-card p-5 transition-colors duration-200 hover:border-primary/30 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <span className="font-medium text-foreground group-hover:text-primary transition-colors duration-200">
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
