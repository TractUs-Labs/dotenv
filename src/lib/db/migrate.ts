import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { env } from "@/lib/env";

export async function runMigrations(): Promise<void> {
  const pool = new Pool({ connectionString: env.databaseUrl() });
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: "./drizzle" });
  await pool.end();
}

if (require.main === module) {
  runMigrations().then(() => process.exit(0));
}
