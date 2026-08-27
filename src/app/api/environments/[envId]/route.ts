import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { requireUser, UnauthorizedError } from "@/lib/auth/session";
import { deleteEnvironment } from "@/lib/projects/projects";
import { roleAtLeast } from "@/lib/access/roles";
import { getOrgRole } from "@/lib/access/authorize";

export async function DELETE(_req: Request, { params }: { params: Promise<{ envId: string }> }) {
  try {
    const user = await requireUser();
    const role = await getOrgRole(getDb(), user.id);
    if (!role || !roleAtLeast(role, "admin")) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const { envId } = await params;
    const environment = await deleteEnvironment(getDb(), { envId, userId: user.id });
    if (!environment) return NextResponse.json({ error: "not found" }, { status: 404 });

    return NextResponse.json({ environment });
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    throw e;
  }
}
