import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { requireUser, UnauthorizedError } from "@/lib/auth/session";
import { deleteProject } from "@/lib/projects/projects";
import { roleAtLeast } from "@/lib/access/roles";
import { getOrgRole } from "@/lib/access/authorize";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await requireUser();
    const role = await getOrgRole(getDb(), user.id);
    if (!role || !roleAtLeast(role, "owner")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const { projectId } = await params;
    const project = await deleteProject(getDb(), { projectId, userId: user.id });
    if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });

    return NextResponse.json({ project });
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    throw e;
  }
}
