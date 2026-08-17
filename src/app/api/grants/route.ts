import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { requireUser, UnauthorizedError } from "@/lib/auth/session";
import { grantAccess, revokeAccess, listUsersWithAccess } from "@/lib/access/grants";
import { grants } from "@/lib/db/schema";
import { roleAtLeast, Role } from "@/lib/access/roles";

async function requireOrgAdmin(userId: string): Promise<boolean> {
  const rows = await getDb().select().from(grants).where(and(eq(grants.userId, userId), eq(grants.scopeType, "org"), isNull(grants.scopeId)));
  const role = rows[0]?.role as Role | undefined;
  return !!role && roleAtLeast(role, "admin");
}

const scopeSchema = z.object({
  userId: z.string().uuid(),
  scopeType: z.enum(["org", "project", "environment"]),
  scopeId: z.string().uuid().nullable(),
});

export async function GET() {
  try {
    const user = await requireUser();
    if (!(await requireOrgAdmin(user.id))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    return NextResponse.json({ users: await listUsersWithAccess(getDb()) });
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    throw e;
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (!(await requireOrgAdmin(user.id))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const body = scopeSchema.extend({ role: z.enum(["owner", "admin", "member", "viewer"]) }).parse(await req.json());
    const grant = await grantAccess(getDb(), { granterId: user.id, userId: body.userId, scope: { scopeType: body.scopeType, scopeId: body.scopeId }, role: body.role });
    return NextResponse.json({ grant }, { status: 201 });
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    throw e;
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireUser();
    if (!(await requireOrgAdmin(user.id))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const body = scopeSchema.parse(await req.json());
    const result = await revokeAccess(getDb(), { revokerId: user.id, userId: body.userId, scope: { scopeType: body.scopeType, scopeId: body.scopeId } });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    throw e;
  }
}
