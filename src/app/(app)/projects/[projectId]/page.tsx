import { getDb } from "@/lib/db/client";
import { getEnvironments, getProject } from "@/lib/projects/projects";
import { notFound } from "next/navigation";
import SecretsClient from "./SecretsClient";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";

export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const db = getDb();
  const project = await getProject(db, projectId);
  if (!project) notFound();
  const environments = await getEnvironments(db, projectId);

  return (
    <main className="max-w-4xl w-full mx-auto px-8 py-8">
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/" className="text-muted-foreground hover:text-foreground text-sm">
              Projects
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="text-foreground text-sm font-medium">{project.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{project.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {environments.length} environment{environments.length !== 1 ? "s" : ""}
        </p>
      </div>

      <Separator className="mb-8 bg-border" />

      {environments.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-sm text-muted-foreground">No environments configured for this project.</p>
        </div>
      ) : (
        environments.map((e) => <SecretsClient key={e.id} envId={e.id} envName={e.name} />)
      )}
    </main>
  );
}
