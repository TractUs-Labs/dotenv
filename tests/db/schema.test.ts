import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { runMigrations } from "@/lib/db/migrate";
import { resetDb, seedUser } from "../helpers/db";

beforeAll(async () => { await runMigrations(); });
beforeEach(async () => { await resetDb(); });

describe("schema", () => {
  it("inserts and reads a user", async () => {
    const u = await seedUser("alice@example.com");
    expect(u.email).toBe("alice@example.com");
    expect(u.id).toBeTruthy();
  });
});
