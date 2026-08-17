import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { getEnvironments } from "@/lib/projects/projects";
import SecretsClient from "./SecretsClient";

export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const session = await auth();
  if (!session?.user?.email) redirect("/signin");
  const { projectId } = await params;
  const environments = await getEnvironments(getDb(), projectId);
  return (
    <main>
      <h1>Project</h1>
      {environments.map((e) => <SecretsClient key={e.id} envId={e.id} envName={e.name} />)}
    </main>
  );
}
