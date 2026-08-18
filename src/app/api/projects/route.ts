import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { requireUser, UnauthorizedError } from "@/lib/auth/session";
import { createProject, listProjectsForUser } from "@/lib/projects/projects";
import { roleAtLeast } from "@/lib/access/roles";
import { getOrgRole } from "@/lib/access/authorize";

export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json({ projects: await listProjectsForUser(getDb(), user.id) });
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    throw e;
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const role = await getOrgRole(getDb(), user.id);
    if (!role || !roleAtLeast(role, "admin")) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const body = z.object({ name: z.string().min(1) }).parse(await req.json());
    const result = await createProject(getDb(), { name: body.name, userId: user.id });
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    throw e;
  }
}
