import { auth } from "@/lib/auth/auth";
import { getDb } from "@/lib/db/client";
import { getEnvironments, getProject } from "@/lib/projects/projects";
import { getOrgRole } from "@/lib/access/authorize";
import { roleAtLeast } from "@/lib/access/roles";
import { notFound } from "next/navigation";
import Link from "next/link";
import ProjectDetailClient from "./ProjectDetailClient";
import { DeleteProjectButton } from "@/components/DeleteProjectButton";
import { AppPage } from "@/components/AppPage";
import { buttonVariants } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const db = getDb();
  const project = await getProject(db, projectId);
  if (!project) notFound();
  const environments = await getEnvironments(db, projectId);

  const session = await auth();
  const userId = (session as unknown as { userId?: string } | null)?.userId;
  const role = userId ? await getOrgRole(db, userId) : null;
  const canDeleteProject = !!role && roleAtLeast(role, "owner");

  return (
    <AppPage>
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/" className="text-muted-foreground hover:text-foreground text-sm">
              Projects
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="text-foreground text-sm font-medium">
              {project.name}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-start justify-between mb-8 gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground text-balance min-w-0">
          {project.name}
        </h1>
        <div className="flex items-center gap-1 shrink-0">
          {canDeleteProject && (
            <DeleteProjectButton projectId={projectId} projectName={project.name} />
          )}
          <Link
            href="/access"
            className={buttonVariants({
              variant: "ghost",
              size: "sm",
              className: "text-muted-foreground hover:text-foreground",
            })}
          >
            Invite
          </Link>
        </div>
      </div>

      <ProjectDetailClient projectId={projectId} environments={environments} />
    </AppPage>
  );
}
