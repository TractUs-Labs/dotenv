import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { requireUser, UnauthorizedError } from "@/lib/auth/session";
import { grantAccess, revokeAccess, listUsersWithAccess } from "@/lib/access/grants";
import { grants } from "@/lib/db/schema";
import { roleAtLeast, roleRank, highestRole, Role } from "@/lib/access/roles";
import { getOrgRole } from "@/lib/access/authorize";

const scopeSchema = z.object({
  userId: z.string().uuid(),
  scopeType: z.enum(["org", "project", "environment"]),
  scopeId: z.string().uuid().nullable(),
});

export async function GET() {
  try {
    const user = await requireUser();
    const granterRole = await getOrgRole(getDb(), user.id);
    if (!granterRole || !roleAtLeast(granterRole, "admin")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    return NextResponse.json({ users: await listUsersWithAccess(getDb()) });
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    throw e;
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const granterRole = await getOrgRole(getDb(), user.id);
    if (!granterRole || !roleAtLeast(granterRole, "admin")) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const body = scopeSchema.extend({ role: z.enum(["owner", "admin", "member", "viewer"]) }).parse(await req.json());

    // Prevent granting a role higher than the granter's own role
    if (roleRank(body.role as Role) > roleRank(granterRole)) {
      return NextResponse.json({ error: "forbidden: cannot grant a role higher than your own" }, { status: 403 });
    }

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
    const granterRole = await getOrgRole(getDb(), user.id);
    if (!granterRole || !roleAtLeast(granterRole, "admin")) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const body = scopeSchema.parse(await req.json());

    // Look up the target user's existing grant to prevent revoking someone with a higher role
    const targetRows = await getDb().select().from(grants).where(
      and(eq(grants.userId, body.userId), eq(grants.scopeType, body.scopeType),
        body.scopeId === null ? isNull(grants.scopeId) : eq(grants.scopeId, body.scopeId))
    );
    const targetRole = highestRole(targetRows.map((r) => r.role as Role));
    if (targetRole && roleRank(targetRole) > roleRank(granterRole)) {
      return NextResponse.json({ error: "forbidden: cannot revoke a user with a higher role than your own" }, { status: 403 });
    }

    const result = await revokeAccess(getDb(), { revokerId: user.id, userId: body.userId, scope: { scopeType: body.scopeType, scopeId: body.scopeId } });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    throw e;
  }
}
