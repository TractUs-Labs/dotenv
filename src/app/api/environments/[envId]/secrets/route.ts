import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { requireUser, UnauthorizedError } from "@/lib/auth/session";
import { effectiveRoleForEnv } from "@/lib/access/authorize";
import { roleAtLeast } from "@/lib/access/roles";
import { createSecret, listSecrets } from "@/lib/secrets/secrets";
import { loadKek } from "@/lib/crypto/kek";
import { env } from "@/lib/env";

export async function GET(_req: Request, { params }: { params: Promise<{ envId: string }> }) {
  try {
    const user = await requireUser();
    const { envId } = await params;
    const role = await effectiveRoleForEnv(getDb(), user.id, envId);
    if (!role || !roleAtLeast(role, "viewer")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    return NextResponse.json({ secrets: await listSecrets(getDb(), envId) });
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    throw e;
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ envId: string }> }) {
  try {
    const user = await requireUser();
    const { envId } = await params;
    const role = await effectiveRoleForEnv(getDb(), user.id, envId);
    if (!role || !roleAtLeast(role, "member")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const body = z.object({ key: z.string().min(1), value: z.string() }).parse(await req.json());
    const secret = await createSecret(getDb(), loadKek(env.kekFile()), { environmentId: envId, key: body.key, value: body.value, userId: user.id });
    return NextResponse.json({ secret }, { status: 201 });
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    throw e;
  }
}
