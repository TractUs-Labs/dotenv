import { getDb } from "@/lib/db/client";
import { getEnvironments, getProject } from "@/lib/projects/projects";
import { notFound } from "next/navigation";
import ProjectDetailClient from "./ProjectDetailClient";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const db = getDb();
  const project = await getProject(db, projectId);
  if (!project) notFound();
  const environments = await getEnvironments(db, projectId);

  return (
    <main className="max-w-5xl w-full mx-auto px-8 py-8">
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

      <div className="flex items-start justify-between mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{project.name}</h1>
        <Link href="/access" className={buttonVariants({ variant: "ghost", size: "sm", className: "text-muted-foreground hover:text-foreground" })}>
          Invite
        </Link>
      </div>

      {environments.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-sm text-muted-foreground">No environments configured for this project.</p>
        </div>
      ) : (
        <ProjectDetailClient environments={environments} />
      )}
    </main>
  );
}
