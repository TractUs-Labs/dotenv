import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { requireUser, UnauthorizedError } from "@/lib/auth/session";
import { canWriteSecret } from "@/lib/access/authorize";
import { rotateSecret } from "@/lib/secrets/secrets";
import { loadKek } from "@/lib/crypto/kek";
import { env } from "@/lib/env";

export async function POST(req: Request, { params }: { params: Promise<{ secretId: string }> }) {
  try {
    const user = await requireUser();
    const { secretId } = await params;
    if (!(await canWriteSecret(getDb(), user.id, secretId))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const body = z.object({ value: z.string() }).parse(await req.json());
    const result = await rotateSecret(getDb(), loadKek(env.kekFile()), { secretId, value: body.value, userId: user.id });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    throw e;
  }
}
