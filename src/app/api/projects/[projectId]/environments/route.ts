import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { requireUser, UnauthorizedError } from "@/lib/auth/session";
import { createEnvironment, getEnvironments, getProject } from "@/lib/projects/projects";
import { roleAtLeast } from "@/lib/access/roles";
import { getOrgRole } from "@/lib/access/authorize";

export async function GET(_req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    await requireUser();
    const { projectId } = await params;
    return NextResponse.json({ environments: await getEnvironments(getDb(), projectId) });
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    throw e;
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireUser();
    const role = await getOrgRole(getDb(), user.id);
    if (!role || !roleAtLeast(role, "admin")) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const { projectId } = await params;
    const project = await getProject(getDb(), projectId);
    if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });

    const body = z.object({ name: z.string().min(1) }).parse(await req.json());
    try {
      const environment = await createEnvironment(getDb(), {
        projectId,
        name: body.name,
        userId: user.id,
      });
      return NextResponse.json({ environment }, { status: 201 });
    } catch (err) {
      // Unique (projectId, name) violation
      if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "23505") {
        return NextResponse.json({ error: "environment already exists" }, { status: 409 });
      }
      throw err;
    }
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    throw e;
  }
}
