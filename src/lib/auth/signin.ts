import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { and, eq, isNull } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { users, grants } from "@/lib/db/schema";

type Db = NodePgDatabase<typeof schema>;
export type GoogleProfile = { email?: string; email_verified?: boolean; hd?: string; name?: string; picture?: string };

export async function handleSignIn(db: Db, profile: GoogleProfile, companyDomain: string): Promise<{ ok: boolean; userId?: string }> {
  if (!profile.email || profile.email_verified !== true || profile.hd !== companyDomain) {
    return { ok: false };
  }

  const existing = await db.select().from(users).where(eq(users.email, profile.email));
  let userId: string;
  if (existing.length > 0) {
    userId = existing[0].id;
    await db.update(users).set({ name: profile.name ?? existing[0].name, image: profile.picture ?? existing[0].image }).where(eq(users.id, userId));
  } else {
    const [created] = await db.insert(users).values({ email: profile.email, name: profile.name ?? null, image: profile.picture ?? null }).returning();
    userId = created.id;
  }

  const owners = await db.select().from(grants).where(and(eq(grants.scopeType, "org"), isNull(grants.scopeId), eq(grants.role, "owner")));
  if (owners.length === 0) {
    await db.insert(grants).values({ userId, scopeType: "org", scopeId: null, role: "owner", grantedBy: userId });
  }

  return { ok: true, userId };
}
