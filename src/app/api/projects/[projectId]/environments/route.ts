import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { requireUser, UnauthorizedError } from "@/lib/auth/session";
import { getEnvironments } from "@/lib/projects/projects";

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
