import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { runMigrations } from "@/lib/db/migrate";
import { resetDb, seedUser, testDb } from "../helpers/db";
import { writeAudit, listAuditLog } from "@/lib/audit/audit";
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

describe("listAuditLog", () => {
  it("returns entries newest first, joined to the actor's email", async () => {
    const alice = await seedUser("alice@example.com");
    const bob = await seedUser("bob@example.com");
    await writeAudit(testDb, { actorId: alice.id, action: "project.create", metadata: { name: "P1" } });
    await writeAudit(testDb, { actorId: bob.id, action: "grant.create", metadata: { role: "member" } });

    const rows = await listAuditLog(testDb);
    expect(rows).toHaveLength(2);
    expect(rows[0].action).toBe("grant.create");
    expect(rows[0].actorEmail).toBe("bob@example.com");
    expect(rows[1].action).toBe("project.create");
    expect(rows[1].actorEmail).toBe("alice@example.com");
  });

  it("respects the limit option", async () => {
    const u = await seedUser("carol@example.com");
    for (let i = 0; i < 5; i++) {
      await writeAudit(testDb, { actorId: u.id, action: `event.${i}` });
    }
    expect(await listAuditLog(testDb, { limit: 2 })).toHaveLength(2);
  });
});
