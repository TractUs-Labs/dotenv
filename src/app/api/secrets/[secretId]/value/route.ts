import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { requireUser, UnauthorizedError } from "@/lib/auth/session";
import { canReadSecret } from "@/lib/access/authorize";
import { getSecretValue } from "@/lib/secrets/secrets";
import { writeAudit } from "@/lib/audit/audit";
import { loadKek } from "@/lib/crypto/kek";
import { env } from "@/lib/env";

export async function GET(_req: Request, { params }: { params: Promise<{ secretId: string }> }) {
  try {
    const user = await requireUser();
    const { secretId } = await params;
    if (!(await canReadSecret(getDb(), user.id, secretId))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const value = await getSecretValue(getDb(), loadKek(env.kekFile()), secretId);
    await writeAudit(getDb(), { actorId: user.id, action: "secret.read", targetType: "secret", targetId: secretId });
    return NextResponse.json({ value });
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    throw e;
  }
}
