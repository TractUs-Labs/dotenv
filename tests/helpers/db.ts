import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { sql } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { users } from "@/lib/db/schema";

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
export const testDb: NodePgDatabase<typeof schema> = drizzle(pool, { schema });

export async function resetDb(): Promise<void> {
  await testDb.execute(sql`
    TRUNCATE audit_log, grants, secret_versions, secrets,
             environments, projects, users RESTART IDENTITY CASCADE
  `);
}

export async function seedUser(email: string) {
  const [u] = await testDb.insert(users).values({ email, name: email }).returning();
  return u;
}
