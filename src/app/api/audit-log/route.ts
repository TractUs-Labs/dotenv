import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { requireUser, UnauthorizedError } from "@/lib/auth/session";
import { getOrgRole } from "@/lib/access/authorize";
import { roleAtLeast } from "@/lib/access/roles";
import { listAuditLog } from "@/lib/audit/audit";

export async function GET() {
  try {
    const user = await requireUser();
    const role = await getOrgRole(getDb(), user.id);
    if (!role || !roleAtLeast(role, "admin")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    return NextResponse.json({ entries: await listAuditLog(getDb()) });
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    throw e;
  }
}
