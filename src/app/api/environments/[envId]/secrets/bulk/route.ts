import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { requireUser, UnauthorizedError } from "@/lib/auth/session";
import { effectiveRoleForEnv } from "@/lib/access/authorize";
import { roleAtLeast } from "@/lib/access/roles";
import { createSecret } from "@/lib/secrets/secrets";
import { loadKek } from "@/lib/crypto/kek";
import { env } from "@/lib/env";

const bodySchema = z.object({
  secrets: z.array(z.object({ key: z.string().min(1), value: z.string() })).min(1).max(500),
});

export async function POST(req: Request, { params }: { params: Promise<{ envId: string }> }) {
  try {
    const user = await requireUser();
    const { envId } = await params;
    const role = await effectiveRoleForEnv(getDb(), user.id, envId);
    if (!role || !roleAtLeast(role, "member")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }

    const kek = loadKek(env.kekFile());
    const db = getDb();
    let created = 0;
    const skipped: string[] = [];

    for (const { key, value } of parsed.data.secrets) {
      try {
        await createSecret(db, kek, { environmentId: envId, key, value, userId: user.id });
        created++;
      } catch {
        skipped.push(key);
      }
    }

    return NextResponse.json({ created, skipped }, { status: 201 });
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    throw e;
  }
}
