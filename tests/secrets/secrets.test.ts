import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { runMigrations } from "@/lib/db/migrate";
import { resetDb, seedUser, testDb } from "../helpers/db";
import { projects, environments } from "@/lib/db/schema";
import { loadKek } from "@/lib/crypto/kek";
import { createSecret, getSecretValue, listSecrets } from "@/lib/secrets/secrets";

const kek = loadKek(process.env.KEK_FILE!);

beforeAll(async () => { await runMigrations(); });
beforeEach(async () => { await resetDb(); });

async function env() {
  const u = await seedUser("alice@example.com");
  const [p] = await testDb.insert(projects).values({ name: "P", slug: "p" }).returning();
  const [e] = await testDb.insert(environments).values({ projectId: p.id, name: "dev" }).returning();
  return { u, e };
}

describe("secrets", () => {
  it("creates a secret and reads back its value", async () => {
    const { u, e } = await env();
    const s = await createSecret(testDb, kek, { environmentId: e.id, key: "API_KEY", value: "abc123", userId: u.id });
    expect(await getSecretValue(testDb, kek, s.id)).toBe("abc123");
  });

  it("lists secret metadata without values", async () => {
    const { u, e } = await env();
    await createSecret(testDb, kek, { environmentId: e.id, key: "API_KEY", value: "abc123", userId: u.id });
    const list = await listSecrets(testDb, e.id);
    expect(list).toHaveLength(1);
    expect(list[0].key).toBe("API_KEY");
    expect(list[0].latestVersion).toBe(1);
    expect(list[0]).not.toHaveProperty("value");
  });
});
