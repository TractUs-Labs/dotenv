import { auth } from "@/lib/auth/auth";
import { redirect, notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { getOrgRole } from "@/lib/access/authorize";
import { roleAtLeast } from "@/lib/access/roles";
import { listUsersWithAccess } from "@/lib/access/grants";
import { listProjects, listAllEnvironments } from "@/lib/projects/projects";
import AccessClient from "./AccessClient";

export default async function AccessPage() {
  const session = await auth();
  const userId = (session as unknown as { userId?: string } | null)?.userId;
  if (!userId) redirect("/signin");

  const db = getDb();
  const role = await getOrgRole(db, userId);
  if (!role || !roleAtLeast(role, "admin")) notFound();

  const [usersWithAccess, projects, environments] = await Promise.all([
    listUsersWithAccess(db),
    listProjects(db),
    listAllEnvironments(db),
  ]);

  return (
    <AccessClient
      initialUsers={usersWithAccess}
      projects={projects.map((p) => ({ id: p.id, name: p.name }))}
      environments={environments.map((e) => ({ id: e.id, projectId: e.projectId, name: e.name }))}
      currentRole={role}
    />
  );
}
