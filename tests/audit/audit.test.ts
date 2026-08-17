import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { runMigrations } from "@/lib/db/migrate";
import { resetDb, seedUser, testDb } from "../helpers/db";
import { writeAudit } from "@/lib/audit/audit";
import { auditLog } from "@/lib/db/schema";

beforeAll(async () => { await runMigrations(); });
beforeEach(async () => { await resetDb(); });

describe("writeAudit", () => {
  it("records an audit entry", async () => {
    const u = await seedUser("alice@example.com");
    await writeAudit(testDb, { actorId: u.id, action: "secret.create", targetType: "secret", targetId: u.id, metadata: { key: "API_KEY" } });
    const rows = await testDb.select().from(auditLog);
    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe("secret.create");
    expect(rows[0].metadata).toEqual({ key: "API_KEY" });
  });
});
