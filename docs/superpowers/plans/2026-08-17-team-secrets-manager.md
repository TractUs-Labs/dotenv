# Team Secrets Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-hosted, server-trusted secrets manager where a ~5–6 person team stores secrets (encrypted at rest with envelope encryption), organizes them into projects/environments, controls access via role-based grants, and rotates/revokes with full audit tracking.

**Architecture:** Next.js (App Router) API routes over a PostgreSQL database accessed through Drizzle ORM. Secret values are encrypted with AES-256-GCM using a per-version data key (DEK), which is itself wrapped by a single master key (KEK) loaded from a mounted file. Authentication is Google Workspace SSO gated to the company domain; authorization is a live per-request check against a `grants` table.

**Tech Stack:** TypeScript, Next.js 15 (App Router), Node 20+, PostgreSQL, Drizzle ORM (`drizzle-orm` + `pg`), Auth.js v5 (`next-auth@beta`) Google provider, Node built-in `crypto` (AES-256-GCM), Vitest for tests, pnpm.

**Spec:** `README.md` (design record — read it alongside this plan; every task argues from it).

## Global Constraints

- **Node** ≥ 20, **TypeScript** strict mode on.
- **Package manager:** pnpm. Every install command uses `pnpm add`.
- **Encryption cipher:** AES-256-GCM via `node:crypto` only. No external crypto libraries. 12-byte IVs, 16-byte auth tags, 32-byte keys.
- **KEK source:** loaded once from the file path in `process.env.KEK_FILE`. The file contains a base64-encoded 32-byte key. The KEK is NEVER stored in the database and NEVER logged.
- **Domain gate:** sign-in is allowed only when the Google profile has `email_verified === true` AND `hd === process.env.COMPANY_DOMAIN`. Never substring-match the email.
- **Authorization:** every secret read/write authorizes live against the `grants` table on each request. Never trust role/permission claims baked into a session token.
- **Roles** (ascending privilege): `viewer` (1) < `member` (2) < `admin` (3) < `owner` (4).
- **Secret versions are append-only.** Rotation adds a new version; it never mutates or deletes an existing one.
- **All secret-mutating and access-mutating actions write an `audit_log` row.**
- **Tests** run against a real Postgres test database given by `process.env.DATABASE_URL` in `.env.test`. Never mock the database.

---

## File Structure

```
src/
  lib/
    env.ts                     # validated environment access
    crypto/
      kek.ts                   # load + validate the master key from KEK_FILE
      envelope.ts              # encryptSecret / decryptSecret (envelope encryption)
    db/
      schema.ts                # Drizzle table definitions
      client.ts                # db connection singleton
      migrate.ts               # programmatic migration runner
    audit/
      audit.ts                 # writeAudit()
    access/
      roles.ts                 # Role type + roleRank + roleAtLeast
      authorize.ts             # effectiveRole / canReadSecret / canWriteSecret / canManageGrants
      grants.ts                # grantAccess / revokeAccess / listUsersWithAccess
    projects/
      projects.ts              # createProject (auto-creates envs) / listProjects / getEnvironments
    secrets/
      secrets.ts               # createSecret / rotateSecret / getSecretValue / listSecrets
    auth/
      signin.ts                # handleSignIn() — domain gate + user upsert + owner bootstrap
      auth.ts                  # Auth.js (next-auth) configuration
      session.ts               # requireUser() helper for route handlers
  app/
    api/
      projects/route.ts        # GET list, POST create
      projects/[projectId]/environments/route.ts   # GET envs
      environments/[envId]/secrets/route.ts        # GET list, POST create
      secrets/[secretId]/value/route.ts            # GET decrypted value
      secrets/[secretId]/rotate/route.ts           # POST new version
      grants/route.ts          # GET users+access, POST grant, DELETE revoke
    (ui)/                      # minimal UI pages (Phase 8)
tests/
  helpers/db.ts                # test DB reset + seed helpers
  crypto/*.test.ts
  access/*.test.ts
  secrets/*.test.ts
  projects/*.test.ts
  auth/*.test.ts
  api/*.test.ts
drizzle/                       # generated SQL migrations
drizzle.config.ts
vitest.config.ts
.env.test
```

---

# Phase 0 — Project scaffolding & test infrastructure

### Task 0.1: Scaffold the Next.js + TypeScript project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `.gitignore`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`

**Interfaces:**
- Produces: a runnable Next.js app; `pnpm dev` serves it.

- [ ] **Step 1: Initialize the project**

```bash
pnpm dlx create-next-app@latest . --ts --app --no-tailwind --no-src-dir=false --eslint --import-alias "@/*" --use-pnpm
```

If the interactive prompt appears, accept: TypeScript yes, App Router yes, `src/` dir yes, import alias `@/*`.

- [ ] **Step 2: Add runtime + dev dependencies**

```bash
pnpm add drizzle-orm pg next-auth@beta zod
pnpm add -D drizzle-kit @types/pg vitest @vitest/coverage-v8 tsx dotenv
```

- [ ] **Step 3: Enable TypeScript strict mode**

In `tsconfig.json` ensure `"strict": true` is set under `compilerOptions`.

- [ ] **Step 4: Verify the app builds**

Run: `pnpm build`
Expected: build completes with no type errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js + TypeScript project with core deps"
```

---

### Task 0.2: Configure Vitest and the test database harness

**Files:**
- Create: `vitest.config.ts`
- Create: `.env.test`
- Create: `tests/helpers/db.ts`
- Create: `src/lib/env.ts`

**Interfaces:**
- Produces: `resetDb(): Promise<void>` and `testDb` (a Drizzle client) from `tests/helpers/db.ts`; `env` object from `src/lib/env.ts`.

- [ ] **Step 1: Write `src/lib/env.ts`**

```typescript
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const env = {
  databaseUrl: () => required("DATABASE_URL"),
  kekFile: () => required("KEK_FILE"),
  companyDomain: () => required("COMPANY_DOMAIN"),
};
```

- [ ] **Step 2: Write `vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";
import dotenv from "dotenv";

dotenv.config({ path: ".env.test" });

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
    fileParallelism: false, // single shared test DB
  },
  resolve: { alias: { "@": "/src" } },
});
```

- [ ] **Step 3: Write `.env.test`**

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/secrets_test
KEK_FILE=./tests/fixtures/test-kek.b64
COMPANY_DOMAIN=example.com
```

Then create the KEK fixture (a random 32-byte base64 key):

```bash
mkdir -p tests/fixtures
node -e "require('fs').writeFileSync('tests/fixtures/test-kek.b64', require('crypto').randomBytes(32).toString('base64'))"
```

- [ ] **Step 4: Add the `test` script to `package.json`**

```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest",
  "db:generate": "drizzle-kit generate",
  "db:migrate": "tsx src/lib/db/migrate.ts"
}
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: add Vitest config and test DB env"
```

---

# Phase 1 — Crypto core (envelope encryption)

### Task 1.1: Load and validate the master key (KEK)

**Files:**
- Create: `src/lib/crypto/kek.ts`
- Test: `tests/crypto/kek.test.ts`

**Interfaces:**
- Produces: `loadKek(filePath: string): Buffer` — returns a 32-byte Buffer; throws if the file is missing or not exactly 32 bytes after base64-decoding.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { loadKek } from "@/lib/crypto/kek";
import { writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";

describe("loadKek", () => {
  it("loads a valid 32-byte base64 key", () => {
    const dir = mkdtempSync(join(tmpdir(), "kek-"));
    const path = join(dir, "kek.b64");
    writeFileSync(path, randomBytes(32).toString("base64"));
    expect(loadKek(path)).toHaveLength(32);
  });

  it("rejects a key of the wrong length", () => {
    const dir = mkdtempSync(join(tmpdir(), "kek-"));
    const path = join(dir, "kek.b64");
    writeFileSync(path, randomBytes(16).toString("base64"));
    expect(() => loadKek(path)).toThrow(/32 bytes/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/crypto/kek.test.ts`
Expected: FAIL — module `@/lib/crypto/kek` not found.

- [ ] **Step 3: Write the implementation**

```typescript
import { readFileSync } from "node:fs";

export function loadKek(filePath: string): Buffer {
  const raw = readFileSync(filePath, "utf8").trim();
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(`KEK must be 32 bytes, got ${key.length} bytes`);
  }
  return key;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/crypto/kek.test.ts`
Expected: PASS (both cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/crypto/kek.ts tests/crypto/kek.test.ts
git commit -m "feat: load and validate master key from file"
```

---

### Task 1.2: Envelope encryption — `encryptSecret` / `decryptSecret`

**Files:**
- Create: `src/lib/crypto/envelope.ts`
- Test: `tests/crypto/envelope.test.ts`

**Interfaces:**
- Consumes: nothing (uses `node:crypto` directly).
- Produces:
  - `interface EncryptedSecret { ciphertext, iv, authTag, wrappedDek, dekIv, dekAuthTag }` — all `string` (base64).
  - `encryptSecret(plaintext: string, kek: Buffer): EncryptedSecret`
  - `decryptSecret(payload: EncryptedSecret, kek: Buffer): string`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { encryptSecret, decryptSecret } from "@/lib/crypto/envelope";
import { randomBytes } from "node:crypto";

const kek = randomBytes(32);

describe("envelope encryption", () => {
  it("round-trips a secret value", () => {
    const payload = encryptSecret("s3cr3t-value", kek);
    expect(decryptSecret(payload, kek)).toBe("s3cr3t-value");
  });

  it("produces different ciphertext for the same input (random DEK/IV)", () => {
    const a = encryptSecret("same", kek);
    const b = encryptSecret("same", kek);
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(a.wrappedDek).not.toBe(b.wrappedDek);
  });

  it("fails to decrypt with the wrong KEK", () => {
    const payload = encryptSecret("value", kek);
    expect(() => decryptSecret(payload, randomBytes(32))).toThrow();
  });

  it("fails to decrypt tampered ciphertext (GCM auth)", () => {
    const payload = encryptSecret("value", kek);
    const tampered = { ...payload, ciphertext: Buffer.from("00".repeat(8), "hex").toString("base64") };
    expect(() => decryptSecret(tampered, kek)).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/crypto/envelope.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```typescript
import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

export interface EncryptedSecret {
  ciphertext: string;
  iv: string;
  authTag: string;
  wrappedDek: string;
  dekIv: string;
  dekAuthTag: string;
}

const ALG = "aes-256-gcm";

function encryptGcm(key: Buffer, plaintext: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALG, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { iv, ciphertext: ct, authTag: cipher.getAuthTag() };
}

function decryptGcm(key: Buffer, iv: Buffer, ciphertext: Buffer, authTag: Buffer) {
  const decipher = createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export function encryptSecret(plaintext: string, kek: Buffer): EncryptedSecret {
  const dek = randomBytes(32);
  const value = encryptGcm(dek, Buffer.from(plaintext, "utf8"));
  const wrapped = encryptGcm(kek, dek);
  return {
    ciphertext: value.ciphertext.toString("base64"),
    iv: value.iv.toString("base64"),
    authTag: value.authTag.toString("base64"),
    wrappedDek: wrapped.ciphertext.toString("base64"),
    dekIv: wrapped.iv.toString("base64"),
    dekAuthTag: wrapped.authTag.toString("base64"),
  };
}

export function decryptSecret(payload: EncryptedSecret, kek: Buffer): string {
  const dek = decryptGcm(
    kek,
    Buffer.from(payload.dekIv, "base64"),
    Buffer.from(payload.wrappedDek, "base64"),
    Buffer.from(payload.dekAuthTag, "base64"),
  );
  const plaintext = decryptGcm(
    dek,
    Buffer.from(payload.iv, "base64"),
    Buffer.from(payload.ciphertext, "base64"),
    Buffer.from(payload.authTag, "base64"),
  );
  return plaintext.toString("utf8");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/crypto/envelope.test.ts`
Expected: PASS (all four cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/crypto/envelope.ts tests/crypto/envelope.test.ts
git commit -m "feat: envelope encryption for secret values"
```

---

# Phase 2 — Database schema & data access

### Task 2.1: Define the Drizzle schema

**Files:**
- Create: `src/lib/db/schema.ts`
- Create: `drizzle.config.ts`

**Interfaces:**
- Produces: exported tables `users`, `projects`, `environments`, `secrets`, `secretVersions`, `grants`, `auditLog`, and enums `roleEnum`, `scopeTypeEnum`.

- [ ] **Step 1: Write `src/lib/db/schema.ts`**

```typescript
import {
  pgTable, uuid, text, integer, boolean, timestamp, jsonb, unique, pgEnum,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["owner", "admin", "member", "viewer"]);
export const scopeTypeEnum = pgEnum("scope_type", ["org", "project", "environment"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const environments = pgTable("environments", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({ uniqEnv: unique().on(t.projectId, t.name) }));

export const secrets = pgTable("secrets", {
  id: uuid("id").defaultRandom().primaryKey(),
  environmentId: uuid("environment_id").notNull().references(() => environments.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  needsRotation: boolean("needs_rotation").default(false).notNull(),
  needsRotationReason: text("needs_rotation_reason"),
  needsRotationAt: timestamp("needs_rotation_at"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({ uniqKey: unique().on(t.environmentId, t.key) }));

export const secretVersions = pgTable("secret_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  secretId: uuid("secret_id").notNull().references(() => secrets.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  ciphertext: text("ciphertext").notNull(),
  iv: text("iv").notNull(),
  authTag: text("auth_tag").notNull(),
  wrappedDek: text("wrapped_dek").notNull(),
  dekIv: text("dek_iv").notNull(),
  dekAuthTag: text("dek_auth_tag").notNull(),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({ uniqVer: unique().on(t.secretId, t.version) }));

export const grants = pgTable("grants", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  scopeType: scopeTypeEnum("scope_type").notNull(),
  scopeId: uuid("scope_id"),
  role: roleEnum("role").notNull(),
  grantedBy: uuid("granted_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const auditLog = pgTable("audit_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorId: uuid("actor_id").references(() => users.id),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: uuid("target_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

> Note on `grants` uniqueness: because Postgres treats NULLs as distinct in unique indexes, org-scoped grants (`scopeId IS NULL`) can't rely on a plain composite unique. Uniqueness for grants is enforced in application code (`grantAccess` upserts by matching on user+scope). This is intentional and covered by Task 4.2.

- [ ] **Step 2: Write `drizzle.config.ts`**

```typescript
import { defineConfig } from "drizzle-kit";
import dotenv from "dotenv";
dotenv.config({ path: ".env.test" });

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

- [ ] **Step 3: Generate the migration**

Run: `pnpm db:generate`
Expected: a SQL file appears under `drizzle/`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/schema.ts drizzle.config.ts drizzle/
git commit -m "feat: database schema and initial migration"
```

---

### Task 2.2: DB client and migration runner; wire up the test harness

**Files:**
- Create: `src/lib/db/client.ts`
- Create: `src/lib/db/migrate.ts`
- Create: `tests/helpers/db.ts`
- Test: `tests/db/schema.test.ts`

**Interfaces:**
- Produces:
  - `getDb(): NodePgDatabase<typeof schema>` from `client.ts` (singleton).
  - `runMigrations(): Promise<void>` from `migrate.ts`.
  - `testDb`, `resetDb(): Promise<void>`, `seedUser(email): Promise<User>` from `tests/helpers/db.ts`.

- [ ] **Step 1: Write `src/lib/db/client.ts`**

```typescript
import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { env } from "@/lib/env";

let db: NodePgDatabase<typeof schema> | null = null;

export function getDb(): NodePgDatabase<typeof schema> {
  if (!db) {
    const pool = new Pool({ connectionString: env.databaseUrl() });
    db = drizzle(pool, { schema });
  }
  return db;
}
```

- [ ] **Step 2: Write `src/lib/db/migrate.ts`**

```typescript
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
```

- [ ] **Step 3: Write `tests/helpers/db.ts`**

```typescript
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
```

- [ ] **Step 4: Write the failing test**

```typescript
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
```

- [ ] **Step 5: Run, apply migrations, verify pass, commit**

Run: `pnpm test tests/db/schema.test.ts`
Expected: PASS (migrations run against the test DB, user round-trips).

If it fails because the test DB doesn't exist, create it: `createdb secrets_test` (or via your local Postgres), then re-run.

```bash
git add src/lib/db/client.ts src/lib/db/migrate.ts tests/helpers/db.ts tests/db/schema.test.ts
git commit -m "feat: db client, migration runner, test harness"
```

---

### Task 2.3: Audit log writer

**Files:**
- Create: `src/lib/audit/audit.ts`
- Test: `tests/audit/audit.test.ts`

**Interfaces:**
- Consumes: `testDb`/`getDb` (Drizzle client), `auditLog` table.
- Produces: `writeAudit(db, entry: { actorId: string | null; action: string; targetType?: string; targetId?: string; metadata?: unknown }): Promise<void>`

- [ ] **Step 1: Write the failing test**

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/audit/audit.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```typescript
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@/lib/db/schema";
import { auditLog } from "@/lib/db/schema";

type Db = NodePgDatabase<typeof schema>;

export async function writeAudit(
  db: Db,
  entry: { actorId: string | null; action: string; targetType?: string; targetId?: string; metadata?: unknown },
): Promise<void> {
  await db.insert(auditLog).values({
    actorId: entry.actorId,
    action: entry.action,
    targetType: entry.targetType ?? null,
    targetId: entry.targetId ?? null,
    metadata: (entry.metadata ?? null) as never,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/audit/audit.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/audit/audit.ts tests/audit/audit.test.ts
git commit -m "feat: audit log writer"
```

---

# Phase 3 — Authorization core

### Task 3.1: Role ranking helpers

**Files:**
- Create: `src/lib/access/roles.ts`
- Test: `tests/access/roles.test.ts`

**Interfaces:**
- Produces:
  - `type Role = "owner" | "admin" | "member" | "viewer"`
  - `roleRank(role: Role): number` (owner=4, admin=3, member=2, viewer=1)
  - `roleAtLeast(role: Role, min: Role): boolean`
  - `highestRole(roles: Role[]): Role | null`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { roleAtLeast, highestRole } from "@/lib/access/roles";

describe("roles", () => {
  it("compares ranks", () => {
    expect(roleAtLeast("admin", "member")).toBe(true);
    expect(roleAtLeast("viewer", "member")).toBe(false);
    expect(roleAtLeast("owner", "owner")).toBe(true);
  });
  it("picks the highest role", () => {
    expect(highestRole(["viewer", "admin", "member"])).toBe("admin");
    expect(highestRole([])).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/access/roles.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```typescript
export type Role = "owner" | "admin" | "member" | "viewer";

const RANK: Record<Role, number> = { owner: 4, admin: 3, member: 2, viewer: 1 };

export function roleRank(role: Role): number {
  return RANK[role];
}

export function roleAtLeast(role: Role, min: Role): boolean {
  return RANK[role] >= RANK[min];
}

export function highestRole(roles: Role[]): Role | null {
  if (roles.length === 0) return null;
  return roles.reduce((a, b) => (RANK[a] >= RANK[b] ? a : b));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/access/roles.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/access/roles.ts tests/access/roles.test.ts
git commit -m "feat: role ranking helpers"
```

---

### Task 3.2: Effective-role resolution and secret authorization

**Files:**
- Create: `src/lib/access/authorize.ts`
- Test: `tests/access/authorize.test.ts`

**Interfaces:**
- Consumes: `Role`, `highestRole`, `roleAtLeast` from `roles.ts`; tables `grants`, `environments`, `secrets`.
- Produces:
  - `effectiveRoleForEnv(db, userId: string, environmentId: string): Promise<Role | null>` — highest role among the user's org, project (owning the env), and environment grants.
  - `canReadSecret(db, userId: string, secretId: string): Promise<boolean>` — effective role ≥ viewer.
  - `canWriteSecret(db, userId: string, secretId: string): Promise<boolean>` — effective role ≥ member.
  - `canManageGrantsForEnv(db, userId: string, environmentId: string): Promise<boolean>` — effective role ≥ admin.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { runMigrations } from "@/lib/db/migrate";
import { resetDb, seedUser, testDb } from "../helpers/db";
import { projects, environments, secrets, grants } from "@/lib/db/schema";
import { effectiveRoleForEnv, canReadSecret, canWriteSecret } from "@/lib/access/authorize";

beforeAll(async () => { await runMigrations(); });
beforeEach(async () => { await resetDb(); });

async function fixture() {
  const user = await seedUser("bob@example.com");
  const [proj] = await testDb.insert(projects).values({ name: "P", slug: "p" }).returning();
  const [env] = await testDb.insert(environments).values({ projectId: proj.id, name: "dev" }).returning();
  const [secret] = await testDb.insert(secrets).values({ environmentId: env.id, key: "K" }).returning();
  return { user, proj, env, secret };
}

describe("authorize", () => {
  it("returns null when the user has no grant", async () => {
    const { user, env } = await fixture();
    expect(await effectiveRoleForEnv(testDb, user.id, env.id)).toBeNull();
  });

  it("resolves an org-scoped grant to all environments", async () => {
    const { user, env } = await fixture();
    await testDb.insert(grants).values({ userId: user.id, scopeType: "org", scopeId: null, role: "admin" });
    expect(await effectiveRoleForEnv(testDb, user.id, env.id)).toBe("admin");
  });

  it("takes the highest of org/project/environment grants", async () => {
    const { user, proj, env } = await fixture();
    await testDb.insert(grants).values({ userId: user.id, scopeType: "project", scopeId: proj.id, role: "viewer" });
    await testDb.insert(grants).values({ userId: user.id, scopeType: "environment", scopeId: env.id, role: "member" });
    expect(await effectiveRoleForEnv(testDb, user.id, env.id)).toBe("member");
  });

  it("viewer can read but not write; member can write", async () => {
    const { user, env, secret } = await fixture();
    await testDb.insert(grants).values({ userId: user.id, scopeType: "environment", scopeId: env.id, role: "viewer" });
    expect(await canReadSecret(testDb, user.id, secret.id)).toBe(true);
    expect(await canWriteSecret(testDb, user.id, secret.id)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/access/authorize.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```typescript
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { and, eq, or, isNull } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { grants, environments, secrets } from "@/lib/db/schema";
import { Role, highestRole, roleAtLeast } from "./roles";

type Db = NodePgDatabase<typeof schema>;

export async function effectiveRoleForEnv(db: Db, userId: string, environmentId: string): Promise<Role | null> {
  const [env] = await db.select().from(environments).where(eq(environments.id, environmentId));
  if (!env) return null;

  const rows = await db.select({ scopeType: grants.scopeType, scopeId: grants.scopeId, role: grants.role })
    .from(grants)
    .where(and(
      eq(grants.userId, userId),
      or(
        and(eq(grants.scopeType, "org"), isNull(grants.scopeId)),
        and(eq(grants.scopeType, "project"), eq(grants.scopeId, env.projectId)),
        and(eq(grants.scopeType, "environment"), eq(grants.scopeId, environmentId)),
      ),
    ));

  return highestRole(rows.map((r) => r.role as Role));
}

async function envIdForSecret(db: Db, secretId: string): Promise<string | null> {
  const [s] = await db.select({ environmentId: secrets.environmentId }).from(secrets).where(eq(secrets.id, secretId));
  return s?.environmentId ?? null;
}

export async function canReadSecret(db: Db, userId: string, secretId: string): Promise<boolean> {
  const envId = await envIdForSecret(db, secretId);
  if (!envId) return false;
  const role = await effectiveRoleForEnv(db, userId, envId);
  return role !== null && roleAtLeast(role, "viewer");
}

export async function canWriteSecret(db: Db, userId: string, secretId: string): Promise<boolean> {
  const envId = await envIdForSecret(db, secretId);
  if (!envId) return false;
  const role = await effectiveRoleForEnv(db, userId, envId);
  return role !== null && roleAtLeast(role, "member");
}

export async function canManageGrantsForEnv(db: Db, userId: string, environmentId: string): Promise<boolean> {
  const role = await effectiveRoleForEnv(db, userId, environmentId);
  return role !== null && roleAtLeast(role, "admin");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/access/authorize.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/access/authorize.ts tests/access/authorize.test.ts
git commit -m "feat: effective-role resolution and secret authorization"
```

---

# Phase 4 — Projects, grants, and revocation

### Task 4.1: Projects and auto-created environments

**Files:**
- Create: `src/lib/projects/projects.ts`
- Test: `tests/projects/projects.test.ts`

**Interfaces:**
- Consumes: tables `projects`, `environments`; `writeAudit`.
- Produces:
  - `createProject(db, { name: string, userId: string }): Promise<{ project: Project; environments: Environment[] }>` — inserts the project and auto-creates `dev`, `staging`, `prod` environments; slug is the lowercased, hyphenated name.
  - `listProjects(db): Promise<Project[]>`
  - `getEnvironments(db, projectId: string): Promise<Environment[]>`
  - Types `Project = typeof projects.$inferSelect`, `Environment = typeof environments.$inferSelect`.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { runMigrations } from "@/lib/db/migrate";
import { resetDb, seedUser, testDb } from "../helpers/db";
import { createProject, listProjects, getEnvironments } from "@/lib/projects/projects";

beforeAll(async () => { await runMigrations(); });
beforeEach(async () => { await resetDb(); });

describe("projects", () => {
  it("creates a project with dev/staging/prod environments", async () => {
    const u = await seedUser("alice@example.com");
    const { project, environments } = await createProject(testDb, { name: "My App", userId: u.id });
    expect(project.slug).toBe("my-app");
    expect(environments.map((e) => e.name).sort()).toEqual(["dev", "prod", "staging"]);
    expect(await getEnvironments(testDb, project.id)).toHaveLength(3);
    expect(await listProjects(testDb)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/projects/projects.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```typescript
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { projects, environments } from "@/lib/db/schema";
import { writeAudit } from "@/lib/audit/audit";

type Db = NodePgDatabase<typeof schema>;
export type Project = typeof projects.$inferSelect;
export type Environment = typeof environments.$inferSelect;

const ENV_NAMES = ["dev", "staging", "prod"] as const;

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export async function createProject(db: Db, input: { name: string; userId: string }): Promise<{ project: Project; environments: Environment[] }> {
  const [project] = await db.insert(projects).values({
    name: input.name, slug: slugify(input.name), createdBy: input.userId,
  }).returning();

  const envs = await db.insert(environments)
    .values(ENV_NAMES.map((name) => ({ projectId: project.id, name })))
    .returning();

  await writeAudit(db, { actorId: input.userId, action: "project.create", targetType: "project", targetId: project.id, metadata: { name: input.name } });
  return { project, environments: envs };
}

export async function listProjects(db: Db): Promise<Project[]> {
  return db.select().from(projects);
}

export async function getEnvironments(db: Db, projectId: string): Promise<Environment[]> {
  return db.select().from(environments).where(eq(environments.projectId, projectId));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/projects/projects.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/projects/projects.ts tests/projects/projects.test.ts
git commit -m "feat: projects with auto-created environments"
```

---

### Task 4.2: Grant access (upsert semantics)

**Files:**
- Create: `src/lib/access/grants.ts`
- Test: `tests/access/grants.test.ts`

**Interfaces:**
- Consumes: table `grants`; `writeAudit`.
- Produces:
  - `type Scope = { scopeType: "org" | "project" | "environment"; scopeId: string | null }`
  - `grantAccess(db, { granterId, userId, scope, role }): Promise<Grant>` — creates or updates the single grant for (userId, scopeType, scopeId); audits `grant.create`. `Grant = typeof grants.$inferSelect`.
  - `listUsersWithAccess(db): Promise<Array<{ user: User; grants: Grant[] }>>` (used by the API/UI).

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { runMigrations } from "@/lib/db/migrate";
import { resetDb, seedUser, testDb } from "../helpers/db";
import { grants } from "@/lib/db/schema";
import { grantAccess } from "@/lib/access/grants";
import { eq } from "drizzle-orm";

beforeAll(async () => { await runMigrations(); });
beforeEach(async () => { await resetDb(); });

describe("grantAccess", () => {
  it("creates a grant", async () => {
    const admin = await seedUser("admin@example.com");
    const bob = await seedUser("bob@example.com");
    const g = await grantAccess(testDb, { granterId: admin.id, userId: bob.id, scope: { scopeType: "org", scopeId: null }, role: "member" });
    expect(g.role).toBe("member");
  });

  it("upserts — re-granting the same scope updates the role, no duplicate row", async () => {
    const admin = await seedUser("admin@example.com");
    const bob = await seedUser("bob@example.com");
    await grantAccess(testDb, { granterId: admin.id, userId: bob.id, scope: { scopeType: "org", scopeId: null }, role: "viewer" });
    await grantAccess(testDb, { granterId: admin.id, userId: bob.id, scope: { scopeType: "org", scopeId: null }, role: "admin" });
    const rows = await testDb.select().from(grants).where(eq(grants.userId, bob.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].role).toBe("admin");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/access/grants.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```typescript
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { and, eq, isNull } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { grants, users } from "@/lib/db/schema";
import { Role } from "./roles";
import { writeAudit } from "@/lib/audit/audit";

type Db = NodePgDatabase<typeof schema>;
export type Grant = typeof grants.$inferSelect;
export type Scope = { scopeType: "org" | "project" | "environment"; scopeId: string | null };

function scopeMatch(userId: string, scope: Scope) {
  return and(
    eq(grants.userId, userId),
    eq(grants.scopeType, scope.scopeType),
    scope.scopeId === null ? isNull(grants.scopeId) : eq(grants.scopeId, scope.scopeId),
  );
}

export async function grantAccess(
  db: Db,
  input: { granterId: string; userId: string; scope: Scope; role: Role },
): Promise<Grant> {
  const existing = await db.select().from(grants).where(scopeMatch(input.userId, input.scope));

  let result: Grant;
  if (existing.length > 0) {
    const [updated] = await db.update(grants).set({ role: input.role, grantedBy: input.granterId })
      .where(eq(grants.id, existing[0].id)).returning();
    result = updated;
  } else {
    const [created] = await db.insert(grants).values({
      userId: input.userId, scopeType: input.scope.scopeType, scopeId: input.scope.scopeId,
      role: input.role, grantedBy: input.granterId,
    }).returning();
    result = created;
  }

  await writeAudit(db, {
    actorId: input.granterId, action: "grant.create", targetType: "user", targetId: input.userId,
    metadata: { scope: input.scope, role: input.role },
  });
  return result;
}

export async function listUsersWithAccess(db: Db) {
  const allUsers = await db.select().from(users);
  const allGrants = await db.select().from(grants);
  return allUsers.map((user) => ({ user, grants: allGrants.filter((g) => g.userId === user.id) }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/access/grants.test.ts`
Expected: PASS (both cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/access/grants.ts tests/access/grants.test.ts
git commit -m "feat: grant access with upsert semantics"
```

---

### Task 4.3: Revoke access — delete grant, flag affected secrets, audit

**Files:**
- Modify: `src/lib/access/grants.ts` (add `revokeAccess` + helper)
- Test: `tests/access/revoke.test.ts`

**Interfaces:**
- Consumes: tables `grants`, `environments`, `secrets`; `writeAudit`; `Scope` from this module.
- Produces:
  - `revokeAccess(db, { revokerId, userId, scope }): Promise<{ revokedCount: number; flaggedSecretIds: string[] }>` — deletes the user's grants matching the scope, marks every secret in the affected environments `needsRotation=true` with reason `access_revoked`, writes an `access.revoke` audit entry containing the flagged secret ids.
  - The set of affected environments: scope `org` → all environments; `project` → that project's environments; `environment` → that one environment.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { runMigrations } from "@/lib/db/migrate";
import { resetDb, seedUser, testDb } from "../helpers/db";
import { projects, environments, secrets, grants, auditLog } from "@/lib/db/schema";
import { grantAccess, revokeAccess } from "@/lib/access/grants";
import { eq } from "drizzle-orm";

beforeAll(async () => { await runMigrations(); });
beforeEach(async () => { await resetDb(); });

async function fixture() {
  const admin = await seedUser("admin@example.com");
  const bob = await seedUser("bob@example.com");
  const [proj] = await testDb.insert(projects).values({ name: "P", slug: "p" }).returning();
  const [dev] = await testDb.insert(environments).values({ projectId: proj.id, name: "dev" }).returning();
  const [prod] = await testDb.insert(environments).values({ projectId: proj.id, name: "prod" }).returning();
  const [s1] = await testDb.insert(secrets).values({ environmentId: dev.id, key: "A" }).returning();
  const [s2] = await testDb.insert(secrets).values({ environmentId: prod.id, key: "B" }).returning();
  return { admin, bob, proj, dev, prod, s1, s2 };
}

describe("revokeAccess", () => {
  it("removes the grant and flags all in-scope secrets for the project scope", async () => {
    const { admin, bob, proj, s1, s2 } = await fixture();
    await grantAccess(testDb, { granterId: admin.id, userId: bob.id, scope: { scopeType: "project", scopeId: proj.id }, role: "member" });

    const result = await revokeAccess(testDb, { revokerId: admin.id, userId: bob.id, scope: { scopeType: "project", scopeId: proj.id } });

    expect(result.revokedCount).toBe(1);
    expect(result.flaggedSecretIds.sort()).toEqual([s1.id, s2.id].sort());
    expect(await testDb.select().from(grants).where(eq(grants.userId, bob.id))).toHaveLength(0);
    const flagged = await testDb.select().from(secrets).where(eq(secrets.needsRotation, true));
    expect(flagged).toHaveLength(2);
    expect(flagged[0].needsRotationReason).toBe("access_revoked");
  });

  it("flags only the one environment for an environment-scoped revoke", async () => {
    const { admin, bob, dev, s1 } = await fixture();
    await grantAccess(testDb, { granterId: admin.id, userId: bob.id, scope: { scopeType: "environment", scopeId: dev.id }, role: "member" });
    const result = await revokeAccess(testDb, { revokerId: admin.id, userId: bob.id, scope: { scopeType: "environment", scopeId: dev.id } });
    expect(result.flaggedSecretIds).toEqual([s1.id]);
  });

  it("writes an audit entry with the flagged secret ids", async () => {
    const { admin, bob, proj } = await fixture();
    await grantAccess(testDb, { granterId: admin.id, userId: bob.id, scope: { scopeType: "project", scopeId: proj.id }, role: "member" });
    await revokeAccess(testDb, { revokerId: admin.id, userId: bob.id, scope: { scopeType: "project", scopeId: proj.id } });
    const entries = (await testDb.select().from(auditLog)).filter((e) => e.action === "access.revoke");
    expect(entries).toHaveLength(1);
    expect((entries[0].metadata as { flaggedSecretIds: string[] }).flaggedSecretIds).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/access/revoke.test.ts`
Expected: FAIL — `revokeAccess` not exported.

- [ ] **Step 3: Add the implementation to `src/lib/access/grants.ts`**

Add these imports at the top (merge with existing): `import { inArray } from "drizzle-orm";` and ensure `environments, secrets` are imported from the schema.

```typescript
async function affectedEnvironmentIds(db: Db, scope: Scope): Promise<string[]> {
  if (scope.scopeType === "org") {
    return (await db.select({ id: environments.id }).from(environments)).map((e) => e.id);
  }
  if (scope.scopeType === "project") {
    return (await db.select({ id: environments.id }).from(environments).where(eq(environments.projectId, scope.scopeId!))).map((e) => e.id);
  }
  return [scope.scopeId!];
}

export async function revokeAccess(
  db: Db,
  input: { revokerId: string; userId: string; scope: Scope },
): Promise<{ revokedCount: number; flaggedSecretIds: string[] }> {
  const deleted = await db.delete(grants).where(scopeMatch(input.userId, input.scope)).returning();

  const envIds = await affectedEnvironmentIds(db, input.scope);
  let flaggedSecretIds: string[] = [];
  if (envIds.length > 0) {
    const flagged = await db.update(secrets)
      .set({ needsRotation: true, needsRotationReason: "access_revoked", needsRotationAt: new Date() })
      .where(inArray(secrets.environmentId, envIds))
      .returning({ id: secrets.id });
    flaggedSecretIds = flagged.map((s) => s.id);
  }

  await writeAudit(db, {
    actorId: input.revokerId, action: "access.revoke", targetType: "user", targetId: input.userId,
    metadata: { scope: input.scope, flaggedSecretIds },
  });

  return { revokedCount: deleted.length, flaggedSecretIds };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/access/revoke.test.ts`
Expected: PASS (all three cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/access/grants.ts tests/access/revoke.test.ts
git commit -m "feat: revoke access with secret flagging and audit"
```

---

# Phase 5 — Secrets

### Task 5.1: Create secret and read latest value

**Files:**
- Create: `src/lib/secrets/secrets.ts`
- Test: `tests/secrets/secrets.test.ts`

**Interfaces:**
- Consumes: `encryptSecret`/`decryptSecret`, `loadKek`; tables `secrets`, `secretVersions`; `writeAudit`.
- Produces:
  - `createSecret(db, kek, { environmentId, key, value, userId }): Promise<Secret>` — inserts the secret row and version 1; unique (environmentId, key). `Secret = typeof secrets.$inferSelect`.
  - `getSecretValue(db, kek, secretId): Promise<string>` — decrypts the highest-version ciphertext.
  - `listSecrets(db, environmentId): Promise<Array<{ id, key, needsRotation, latestVersion }>>` — metadata only, never values.

- [ ] **Step 1: Write the failing test**

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/secrets/secrets.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```typescript
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { and, eq, desc } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { secrets, secretVersions } from "@/lib/db/schema";
import { encryptSecret, decryptSecret } from "@/lib/crypto/envelope";
import { writeAudit } from "@/lib/audit/audit";

type Db = NodePgDatabase<typeof schema>;
export type Secret = typeof secrets.$inferSelect;

export async function createSecret(
  db: Db, kek: Buffer,
  input: { environmentId: string; key: string; value: string; userId: string },
): Promise<Secret> {
  const [secret] = await db.insert(secrets).values({
    environmentId: input.environmentId, key: input.key, createdBy: input.userId,
  }).returning();

  const enc = encryptSecret(input.value, kek);
  await db.insert(secretVersions).values({ secretId: secret.id, version: 1, createdBy: input.userId, ...enc });

  await writeAudit(db, { actorId: input.userId, action: "secret.create", targetType: "secret", targetId: secret.id, metadata: { key: input.key } });
  return secret;
}

async function latestVersionRow(db: Db, secretId: string) {
  const [row] = await db.select().from(secretVersions)
    .where(eq(secretVersions.secretId, secretId)).orderBy(desc(secretVersions.version)).limit(1);
  return row ?? null;
}

export async function getSecretValue(db: Db, kek: Buffer, secretId: string): Promise<string> {
  const row = await latestVersionRow(db, secretId);
  if (!row) throw new Error("Secret has no versions");
  return decryptSecret(row, kek);
}

export async function listSecrets(db: Db, environmentId: string) {
  const rows = await db.select().from(secrets).where(eq(secrets.environmentId, environmentId));
  const out = [];
  for (const s of rows) {
    const latest = await latestVersionRow(db, s.id);
    out.push({ id: s.id, key: s.key, needsRotation: s.needsRotation, latestVersion: latest?.version ?? 0 });
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/secrets/secrets.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/secrets/secrets.ts tests/secrets/secrets.test.ts
git commit -m "feat: create secret, read latest value, list metadata"
```

---

### Task 5.2: Rotate secret (append version, clear rotation flag)

**Files:**
- Modify: `src/lib/secrets/secrets.ts` (add `rotateSecret`)
- Test: `tests/secrets/rotate.test.ts`

**Interfaces:**
- Consumes: everything from Task 5.1.
- Produces:
  - `rotateSecret(db, kek, { secretId, value, userId }): Promise<{ version: number }>` — appends a new version = (max existing version + 1), and clears `needsRotation` back to `false` (sets reason/at to null). Audits `secret.rotate`.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { runMigrations } from "@/lib/db/migrate";
import { resetDb, seedUser, testDb } from "../helpers/db";
import { projects, environments, secrets } from "@/lib/db/schema";
import { loadKek } from "@/lib/crypto/kek";
import { createSecret, rotateSecret, getSecretValue } from "@/lib/secrets/secrets";
import { eq } from "drizzle-orm";

const kek = loadKek(process.env.KEK_FILE!);
beforeAll(async () => { await runMigrations(); });
beforeEach(async () => { await resetDb(); });

describe("rotateSecret", () => {
  it("appends a new version and returns the newest value", async () => {
    const u = await seedUser("alice@example.com");
    const [p] = await testDb.insert(projects).values({ name: "P", slug: "p" }).returning();
    const [e] = await testDb.insert(environments).values({ projectId: p.id, name: "dev" }).returning();
    const s = await createSecret(testDb, kek, { environmentId: e.id, key: "K", value: "v1", userId: u.id });

    const { version } = await rotateSecret(testDb, kek, { secretId: s.id, value: "v2", userId: u.id });

    expect(version).toBe(2);
    expect(await getSecretValue(testDb, kek, s.id)).toBe("v2");
  });

  it("clears the needs_rotation flag", async () => {
    const u = await seedUser("alice@example.com");
    const [p] = await testDb.insert(projects).values({ name: "P", slug: "p" }).returning();
    const [e] = await testDb.insert(environments).values({ projectId: p.id, name: "dev" }).returning();
    const s = await createSecret(testDb, kek, { environmentId: e.id, key: "K", value: "v1", userId: u.id });
    await testDb.update(secrets).set({ needsRotation: true, needsRotationReason: "access_revoked" }).where(eq(secrets.id, s.id));

    await rotateSecret(testDb, kek, { secretId: s.id, value: "v2", userId: u.id });

    const [after] = await testDb.select().from(secrets).where(eq(secrets.id, s.id));
    expect(after.needsRotation).toBe(false);
    expect(after.needsRotationReason).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/secrets/rotate.test.ts`
Expected: FAIL — `rotateSecret` not exported.

- [ ] **Step 3: Add the implementation to `src/lib/secrets/secrets.ts`**

```typescript
export async function rotateSecret(
  db: Db, kek: Buffer,
  input: { secretId: string; value: string; userId: string },
): Promise<{ version: number }> {
  const latest = await latestVersionRow(db, input.secretId);
  const nextVersion = (latest?.version ?? 0) + 1;

  const enc = encryptSecret(input.value, kek);
  await db.insert(secretVersions).values({ secretId: input.secretId, version: nextVersion, createdBy: input.userId, ...enc });

  await db.update(secrets)
    .set({ needsRotation: false, needsRotationReason: null, needsRotationAt: null })
    .where(eq(secrets.id, input.secretId));

  await writeAudit(db, { actorId: input.userId, action: "secret.rotate", targetType: "secret", targetId: input.secretId, metadata: { version: nextVersion } });
  return { version: nextVersion };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/secrets/rotate.test.ts`
Expected: PASS (both cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/secrets/secrets.ts tests/secrets/rotate.test.ts
git commit -m "feat: rotate secret by appending version and clearing flag"
```

---

# Phase 6 — Authentication (Google SSO + domain gate + owner bootstrap)

### Task 6.1: `handleSignIn` — domain gate, user upsert, owner bootstrap

**Files:**
- Create: `src/lib/auth/signin.ts`
- Test: `tests/auth/signin.test.ts`

**Interfaces:**
- Consumes: tables `users`, `grants`; `env.companyDomain()`.
- Produces:
  - `type GoogleProfile = { email?: string; email_verified?: boolean; hd?: string; name?: string; picture?: string }`
  - `handleSignIn(db, profile: GoogleProfile, companyDomain: string): Promise<{ ok: boolean; userId?: string }>` — returns `{ ok: false }` unless `email_verified === true` and `hd === companyDomain`; otherwise upserts the user by email and, if no org-scoped `owner` grant exists yet, creates one for this user (bootstrap).

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { runMigrations } from "@/lib/db/migrate";
import { resetDb, testDb } from "../helpers/db";
import { users, grants } from "@/lib/db/schema";
import { handleSignIn } from "@/lib/auth/signin";
import { and, eq, isNull } from "drizzle-orm";

beforeAll(async () => { await runMigrations(); });
beforeEach(async () => { await resetDb(); });

const good = { email: "alice@example.com", email_verified: true, hd: "example.com", name: "Alice" };

describe("handleSignIn", () => {
  it("rejects a non-company domain", async () => {
    const r = await handleSignIn(testDb, { ...good, hd: "evil.com" }, "example.com");
    expect(r.ok).toBe(false);
    expect(await testDb.select().from(users)).toHaveLength(0);
  });

  it("rejects an unverified email", async () => {
    const r = await handleSignIn(testDb, { ...good, email_verified: false }, "example.com");
    expect(r.ok).toBe(false);
  });

  it("accepts a company user and upserts them", async () => {
    const r = await handleSignIn(testDb, good, "example.com");
    expect(r.ok).toBe(true);
    expect(r.userId).toBeTruthy();
    expect(await testDb.select().from(users)).toHaveLength(1);
  });

  it("bootstraps the first user as org owner, but not the second", async () => {
    await handleSignIn(testDb, good, "example.com");
    await handleSignIn(testDb, { ...good, email: "bob@example.com", name: "Bob" }, "example.com");
    const ownerGrants = await testDb.select().from(grants).where(and(eq(grants.scopeType, "org"), isNull(grants.scopeId), eq(grants.role, "owner")));
    expect(ownerGrants).toHaveLength(1);
  });

  it("is idempotent for the same user (no duplicate rows)", async () => {
    await handleSignIn(testDb, good, "example.com");
    await handleSignIn(testDb, good, "example.com");
    expect(await testDb.select().from(users)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/auth/signin.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/auth/signin.test.ts`
Expected: PASS (all five cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/signin.ts tests/auth/signin.test.ts
git commit -m "feat: sign-in domain gate, user upsert, owner bootstrap"
```

---

### Task 6.2: Auth.js configuration and `requireUser` session helper

**Files:**
- Create: `src/lib/auth/auth.ts`
- Create: `src/lib/auth/session.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Test: `tests/auth/session.test.ts`

**Interfaces:**
- Consumes: `handleSignIn`, `getDb`, `env`.
- Produces:
  - From `auth.ts`: `handlers`, `auth`, `signIn`, `signOut` (Auth.js v5 exports). The `signIn` callback calls `handleSignIn`; the `jwt`/`session` callbacks attach `userId` to the session.
  - From `session.ts`: `requireUser(): Promise<{ id: string; email: string }>` — reads the Auth.js session; throws `UnauthorizedError` if absent. `class UnauthorizedError extends Error`.

- [ ] **Step 1: Write `src/lib/auth/auth.ts`**

```typescript
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { getDb } from "@/lib/db/client";
import { handleSignIn, GoogleProfile } from "./signin";
import { env } from "@/lib/env";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google({ authorization: { params: { hd: env.companyDomain() } } })],
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ profile }) {
      const result = await handleSignIn(getDb(), profile as GoogleProfile, env.companyDomain());
      return result.ok;
    },
    async jwt({ token, profile }) {
      if (profile?.email) {
        const [u] = await getDb().select().from((await import("@/lib/db/schema")).users)
          .where((await import("drizzle-orm")).eq((await import("@/lib/db/schema")).users.email, profile.email));
        if (u) token.userId = u.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.userId) (session as { userId?: string }).userId = token.userId as string;
      return session;
    },
  },
});
```

- [ ] **Step 2: Write `src/app/api/auth/[...nextauth]/route.ts` and `src/lib/auth/session.ts`**

`route.ts`:

```typescript
import { handlers } from "@/lib/auth/auth";
export const { GET, POST } = handlers;
```

`session.ts`:

```typescript
import { auth } from "./auth";

export class UnauthorizedError extends Error {
  constructor() { super("Unauthorized"); this.name = "UnauthorizedError"; }
}

export async function requireUser(): Promise<{ id: string; email: string }> {
  const session = await auth();
  const userId = (session as { userId?: string } | null)?.userId;
  const email = session?.user?.email;
  if (!userId || !email) throw new UnauthorizedError();
  return { id: userId, email };
}
```

- [ ] **Step 3: Write the failing test (UnauthorizedError shape — the pure part we can unit-test)**

```typescript
import { describe, it, expect } from "vitest";
import { UnauthorizedError } from "@/lib/auth/session";

describe("session", () => {
  it("UnauthorizedError has the right name", () => {
    const e = new UnauthorizedError();
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe("UnauthorizedError");
  });
});
```

- [ ] **Step 4: Run tests and typecheck**

Run: `pnpm test tests/auth/session.test.ts && pnpm build`
Expected: test PASS; build compiles (Auth.js config type-checks). Add `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, and `COMPANY_DOMAIN` to `.env.local` for the dev server (not needed for the unit test).

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/auth.ts src/lib/auth/session.ts src/app/api/auth tests/auth/session.test.ts
git commit -m "feat: Auth.js Google config and requireUser helper"
```

---

# Phase 7 — API routes (authorization enforced here)

> Each route handler: (1) `requireUser()`, (2) authorize via the Phase 3 helpers against the *current* grants, (3) call the Phase 4/5 library function, (4) return JSON. On `UnauthorizedError` return 401; on a failed authorization check return 403.

### Task 7.1: Projects API — list and create

**Files:**
- Create: `src/app/api/projects/route.ts`
- Create: `src/app/api/projects/[projectId]/environments/route.ts`
- Test: `tests/api/projects.test.ts`

**Interfaces:**
- Consumes: `requireUser`, `createProject`, `listProjects`, `getEnvironments`, `effectiveRoleForEnv`/grants for authz, `getDb`.
- Produces: `GET /api/projects`, `POST /api/projects` (body `{ name }`, requires an org-scoped role ≥ admin to create), `GET /api/projects/:projectId/environments`.

- [ ] **Step 1: Write the failing test (exercise the handler functions directly)**

```typescript
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { runMigrations } from "@/lib/db/migrate";
import { resetDb, seedUser, testDb } from "../helpers/db";
import { grants } from "@/lib/db/schema";

vi.mock("@/lib/db/client", () => ({ getDb: () => testDb }));
const requireUserMock = vi.fn();
vi.mock("@/lib/auth/session", () => ({ requireUser: () => requireUserMock(), UnauthorizedError: class extends Error {} }));

beforeAll(async () => { await runMigrations(); });
beforeEach(async () => { await resetDb(); vi.clearAllMocks(); });

describe("projects API", () => {
  it("creates a project when the user is an org admin", async () => {
    const admin = await seedUser("admin@example.com");
    await testDb.insert(grants).values({ userId: admin.id, scopeType: "org", scopeId: null, role: "admin" });
    requireUserMock.mockResolvedValue({ id: admin.id, email: admin.email });

    const { POST } = await import("@/app/api/projects/route");
    const res = await POST(new Request("http://x/api/projects", { method: "POST", body: JSON.stringify({ name: "My App" }) }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.project.slug).toBe("my-app");
  });

  it("returns 403 for a viewer", async () => {
    const viewer = await seedUser("v@example.com");
    await testDb.insert(grants).values({ userId: viewer.id, scopeType: "org", scopeId: null, role: "viewer" });
    requireUserMock.mockResolvedValue({ id: viewer.id, email: viewer.email });

    const { POST } = await import("@/app/api/projects/route");
    const res = await POST(new Request("http://x/api/projects", { method: "POST", body: JSON.stringify({ name: "Nope" }) }));
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/api/projects.test.ts`
Expected: FAIL — route module not found.

- [ ] **Step 3: Write `src/app/api/projects/route.ts` and the environments route**

`src/app/api/projects/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { requireUser, UnauthorizedError } from "@/lib/auth/session";
import { createProject, listProjects } from "@/lib/projects/projects";
import { grants } from "@/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { roleAtLeast, Role } from "@/lib/access/roles";

async function orgRole(userId: string): Promise<Role | null> {
  const rows = await getDb().select().from(grants).where(and(eq(grants.userId, userId), eq(grants.scopeType, "org"), isNull(grants.scopeId)));
  return (rows[0]?.role as Role) ?? null;
}

export async function GET() {
  try {
    await requireUser();
    return NextResponse.json({ projects: await listProjects(getDb()) });
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    throw e;
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const role = await orgRole(user.id);
    if (!role || !roleAtLeast(role, "admin")) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const body = z.object({ name: z.string().min(1) }).parse(await req.json());
    const result = await createProject(getDb(), { name: body.name, userId: user.id });
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    throw e;
  }
}
```

`src/app/api/projects/[projectId]/environments/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { requireUser, UnauthorizedError } from "@/lib/auth/session";
import { getEnvironments } from "@/lib/projects/projects";

export async function GET(_req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    await requireUser();
    const { projectId } = await params;
    return NextResponse.json({ environments: await getEnvironments(getDb(), projectId) });
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    throw e;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/api/projects.test.ts`
Expected: PASS (both cases).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/projects tests/api/projects.test.ts
git commit -m "feat: projects API with org-admin authorization"
```

---

### Task 7.2: Secrets API — list, create, read value, rotate

**Files:**
- Create: `src/app/api/environments/[envId]/secrets/route.ts`
- Create: `src/app/api/secrets/[secretId]/value/route.ts`
- Create: `src/app/api/secrets/[secretId]/rotate/route.ts`
- Test: `tests/api/secrets.test.ts`

**Interfaces:**
- Consumes: `requireUser`; `effectiveRoleForEnv`, `canReadSecret`, `canWriteSecret`; `createSecret`, `listSecrets`, `getSecretValue`, `rotateSecret`; `loadKek`, `env.kekFile()`; `getDb`.
- Produces:
  - `GET /api/environments/:envId/secrets` — requires effective role ≥ viewer on the env; returns metadata.
  - `POST /api/environments/:envId/secrets` (body `{ key, value }`) — requires ≥ member.
  - `GET /api/secrets/:secretId/value` — requires `canReadSecret`; returns `{ value }` and writes a `secret.read` audit entry.
  - `POST /api/secrets/:secretId/rotate` (body `{ value }`) — requires `canWriteSecret`.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { runMigrations } from "@/lib/db/migrate";
import { resetDb, seedUser, testDb } from "../helpers/db";
import { projects, environments, grants } from "@/lib/db/schema";

vi.mock("@/lib/db/client", () => ({ getDb: () => testDb }));
const requireUserMock = vi.fn();
vi.mock("@/lib/auth/session", () => ({ requireUser: () => requireUserMock(), UnauthorizedError: class extends Error {} }));

beforeAll(async () => { await runMigrations(); });
beforeEach(async () => { await resetDb(); vi.clearAllMocks(); });

async function setup(role: "viewer" | "member") {
  const user = await seedUser("u@example.com");
  const [p] = await testDb.insert(projects).values({ name: "P", slug: "p" }).returning();
  const [e] = await testDb.insert(environments).values({ projectId: p.id, name: "dev" }).returning();
  await testDb.insert(grants).values({ userId: user.id, scopeType: "environment", scopeId: e.id, role });
  requireUserMock.mockResolvedValue({ id: user.id, email: user.email });
  return { user, e };
}

describe("secrets API", () => {
  it("member can create and read back a secret value", async () => {
    const { e } = await setup("member");
    const { POST: create } = await import("@/app/api/environments/[envId]/secrets/route");
    const createRes = await create(new Request("http://x", { method: "POST", body: JSON.stringify({ key: "K", value: "v1" }) }), { params: Promise.resolve({ envId: e.id }) });
    expect(createRes.status).toBe(201);
    const { secret } = await createRes.json();

    const { GET: getValue } = await import("@/app/api/secrets/[secretId]/value/route");
    const valRes = await getValue(new Request("http://x"), { params: Promise.resolve({ secretId: secret.id }) });
    expect((await valRes.json()).value).toBe("v1");
  });

  it("viewer cannot create a secret (403)", async () => {
    const { e } = await setup("viewer");
    const { POST: create } = await import("@/app/api/environments/[envId]/secrets/route");
    const res = await create(new Request("http://x", { method: "POST", body: JSON.stringify({ key: "K", value: "v1" }) }), { params: Promise.resolve({ envId: e.id }) });
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/api/secrets.test.ts`
Expected: FAIL — route modules not found.

- [ ] **Step 3: Write the three route files**

`src/app/api/environments/[envId]/secrets/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { requireUser, UnauthorizedError } from "@/lib/auth/session";
import { effectiveRoleForEnv } from "@/lib/access/authorize";
import { roleAtLeast } from "@/lib/access/roles";
import { createSecret, listSecrets } from "@/lib/secrets/secrets";
import { loadKek } from "@/lib/crypto/kek";
import { env } from "@/lib/env";

export async function GET(_req: Request, { params }: { params: Promise<{ envId: string }> }) {
  try {
    const user = await requireUser();
    const { envId } = await params;
    const role = await effectiveRoleForEnv(getDb(), user.id, envId);
    if (!role || !roleAtLeast(role, "viewer")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    return NextResponse.json({ secrets: await listSecrets(getDb(), envId) });
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    throw e;
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ envId: string }> }) {
  try {
    const user = await requireUser();
    const { envId } = await params;
    const role = await effectiveRoleForEnv(getDb(), user.id, envId);
    if (!role || !roleAtLeast(role, "member")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const body = z.object({ key: z.string().min(1), value: z.string() }).parse(await req.json());
    const secret = await createSecret(getDb(), loadKek(env.kekFile()), { environmentId: envId, key: body.key, value: body.value, userId: user.id });
    return NextResponse.json({ secret }, { status: 201 });
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    throw e;
  }
}
```

`src/app/api/secrets/[secretId]/value/route.ts`:

```typescript
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
```

`src/app/api/secrets/[secretId]/rotate/route.ts`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/api/secrets.test.ts`
Expected: PASS (both cases).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/environments src/app/api/secrets tests/api/secrets.test.ts
git commit -m "feat: secrets API with per-request authorization"
```

---

### Task 7.3: Grants API — list users, grant, revoke

**Files:**
- Create: `src/app/api/grants/route.ts`
- Test: `tests/api/grants.test.ts`

**Interfaces:**
- Consumes: `requireUser`; `grantAccess`, `revokeAccess`, `listUsersWithAccess`; org-role check (≥ admin required to manage grants); `getDb`.
- Produces:
  - `GET /api/grants` — requires ≥ admin (org); returns users with their grants.
  - `POST /api/grants` (body `{ userId, scopeType, scopeId, role }`) — requires ≥ admin (org); calls `grantAccess`.
  - `DELETE /api/grants` (body `{ userId, scopeType, scopeId }`) — requires ≥ admin (org); calls `revokeAccess`, returns `{ revokedCount, flaggedSecretIds }`.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { runMigrations } from "@/lib/db/migrate";
import { resetDb, seedUser, testDb } from "../helpers/db";
import { projects, environments, secrets, grants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

vi.mock("@/lib/db/client", () => ({ getDb: () => testDb }));
const requireUserMock = vi.fn();
vi.mock("@/lib/auth/session", () => ({ requireUser: () => requireUserMock(), UnauthorizedError: class extends Error {} }));

beforeAll(async () => { await runMigrations(); });
beforeEach(async () => { await resetDb(); vi.clearAllMocks(); });

describe("grants API", () => {
  it("admin revokes a user and the response lists flagged secrets", async () => {
    const admin = await seedUser("admin@example.com");
    await testDb.insert(grants).values({ userId: admin.id, scopeType: "org", scopeId: null, role: "admin" });
    const bob = await seedUser("bob@example.com");
    const [p] = await testDb.insert(projects).values({ name: "P", slug: "p" }).returning();
    const [e] = await testDb.insert(environments).values({ projectId: p.id, name: "dev" }).returning();
    await testDb.insert(secrets).values({ environmentId: e.id, key: "K" });
    await testDb.insert(grants).values({ userId: bob.id, scopeType: "project", scopeId: p.id, role: "member" });
    requireUserMock.mockResolvedValue({ id: admin.id, email: admin.email });

    const { DELETE } = await import("@/app/api/grants/route");
    const res = await DELETE(new Request("http://x", { method: "DELETE", body: JSON.stringify({ userId: bob.id, scopeType: "project", scopeId: p.id }) }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.revokedCount).toBe(1);
    expect(body.flaggedSecretIds).toHaveLength(1);
    expect(await testDb.select().from(grants).where(eq(grants.userId, bob.id))).toHaveLength(0);
  });

  it("member cannot manage grants (403)", async () => {
    const member = await seedUser("m@example.com");
    await testDb.insert(grants).values({ userId: member.id, scopeType: "org", scopeId: null, role: "member" });
    requireUserMock.mockResolvedValue({ id: member.id, email: member.email });
    const { POST } = await import("@/app/api/grants/route");
    const res = await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ userId: member.id, scopeType: "org", scopeId: null, role: "admin" }) }));
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/api/grants.test.ts`
Expected: FAIL — route module not found.

- [ ] **Step 3: Write `src/app/api/grants/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { requireUser, UnauthorizedError } from "@/lib/auth/session";
import { grantAccess, revokeAccess, listUsersWithAccess } from "@/lib/access/grants";
import { grants } from "@/lib/db/schema";
import { roleAtLeast, Role } from "@/lib/access/roles";

async function requireOrgAdmin(userId: string): Promise<boolean> {
  const rows = await getDb().select().from(grants).where(and(eq(grants.userId, userId), eq(grants.scopeType, "org"), isNull(grants.scopeId)));
  const role = rows[0]?.role as Role | undefined;
  return !!role && roleAtLeast(role, "admin");
}

const scopeSchema = z.object({
  userId: z.string().uuid(),
  scopeType: z.enum(["org", "project", "environment"]),
  scopeId: z.string().uuid().nullable(),
});

export async function GET() {
  try {
    const user = await requireUser();
    if (!(await requireOrgAdmin(user.id))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    return NextResponse.json({ users: await listUsersWithAccess(getDb()) });
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    throw e;
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (!(await requireOrgAdmin(user.id))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const body = scopeSchema.extend({ role: z.enum(["owner", "admin", "member", "viewer"]) }).parse(await req.json());
    const grant = await grantAccess(getDb(), { granterId: user.id, userId: body.userId, scope: { scopeType: body.scopeType, scopeId: body.scopeId }, role: body.role });
    return NextResponse.json({ grant }, { status: 201 });
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    throw e;
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireUser();
    if (!(await requireOrgAdmin(user.id))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const body = scopeSchema.parse(await req.json());
    const result = await revokeAccess(getDb(), { revokerId: user.id, userId: body.userId, scope: { scopeType: body.scopeType, scopeId: body.scopeId } });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    throw e;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/api/grants.test.ts`
Expected: PASS (both cases).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/grants tests/api/grants.test.ts
git commit -m "feat: grants API with grant/revoke and admin authorization"
```

---

# Phase 8 — Minimal UI

> The UI is intentionally thin: a server-rendered dashboard that calls the same library functions. These pages are verified by `pnpm build` and manual smoke testing, not component tests — the security logic is already covered by Phases 1–7.

### Task 8.1: Auth-gated dashboard shell with sign-in/out

**Files:**
- Create: `src/app/page.tsx` (replace scaffold)
- Create: `src/app/signin/page.tsx`
- Modify: `src/app/layout.tsx` (basic layout, no styling framework required)

**Interfaces:**
- Consumes: `auth`, `signIn`, `signOut` from `@/lib/auth/auth`.
- Produces: a home page that shows the signed-in user's email and a sign-out button, or redirects to `/signin` with a "Sign in with Google" button when unauthenticated.

- [ ] **Step 1: Write `src/app/signin/page.tsx`**

```tsx
import { signIn } from "@/lib/auth/auth";

export default function SignInPage() {
  return (
    <form action={async () => { "use server"; await signIn("google", { redirectTo: "/" }); }}>
      <button type="submit">Sign in with Google</button>
    </form>
  );
}
```

- [ ] **Step 2: Write `src/app/page.tsx`**

```tsx
import { auth, signOut } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { listProjects } from "@/lib/projects/projects";

export default async function Home() {
  const session = await auth();
  if (!session?.user?.email) redirect("/signin");
  const projects = await listProjects(getDb());
  return (
    <main>
      <p>Signed in as {session.user.email}</p>
      <form action={async () => { "use server"; await signOut({ redirectTo: "/signin" }); }}>
        <button type="submit">Sign out</button>
      </form>
      <h1>Projects</h1>
      <ul>{projects.map((p) => <li key={p.id}><a href={`/projects/${p.id}`}>{p.name}</a></li>)}</ul>
    </main>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `pnpm build`
Expected: compiles with no type errors.

- [ ] **Step 4: Manual smoke test**

Start `pnpm dev`, visit `/`, confirm redirect to `/signin` when logged out. (Google OAuth requires real `AUTH_GOOGLE_ID`/`SECRET` in `.env.local`; if unavailable, verify the redirect and page render only.)

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/app/signin src/app/layout.tsx
git commit -m "feat: auth-gated dashboard shell"
```

---

### Task 8.2: Project detail — environments, secrets, and the rotation-needed banner

**Files:**
- Create: `src/app/projects/[projectId]/page.tsx`
- Create: `src/app/projects/[projectId]/SecretsClient.tsx` (client component that calls the JSON APIs)

**Interfaces:**
- Consumes: the Phase 7 JSON APIs (`/api/projects/:id/environments`, `/api/environments/:id/secrets`, `/api/secrets/:id/value`, `/api/secrets/:id/rotate`).
- Produces: a page listing each environment's secrets, a per-secret "reveal value" and "rotate" action, and a visible **"needs rotation"** badge for any secret with `needsRotation === true` (this is how a revoked-access flag surfaces to admins).

- [ ] **Step 1: Write `src/app/projects/[projectId]/page.tsx`**

```tsx
import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { getEnvironments } from "@/lib/projects/projects";
import SecretsClient from "./SecretsClient";

export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const session = await auth();
  if (!session?.user?.email) redirect("/signin");
  const { projectId } = await params;
  const environments = await getEnvironments(getDb(), projectId);
  return (
    <main>
      <h1>Project</h1>
      {environments.map((e) => <SecretsClient key={e.id} envId={e.id} envName={e.name} />)}
    </main>
  );
}
```

- [ ] **Step 2: Write `src/app/projects/[projectId]/SecretsClient.tsx`**

```tsx
"use client";
import { useEffect, useState } from "react";

type SecretMeta = { id: string; key: string; needsRotation: boolean; latestVersion: number };

export default function SecretsClient({ envId, envName }: { envId: string; envName: string }) {
  const [secrets, setSecrets] = useState<SecretMeta[]>([]);
  const [revealed, setRevealed] = useState<Record<string, string>>({});

  async function load() {
    const res = await fetch(`/api/environments/${envId}/secrets`);
    if (res.ok) setSecrets((await res.json()).secrets);
  }
  useEffect(() => { load(); }, [envId]);

  async function reveal(id: string) {
    const res = await fetch(`/api/secrets/${id}/value`);
    if (res.ok) setRevealed((r) => ({ ...r, [id]: (await res.json()).value }));
  }
  async function rotate(id: string) {
    const value = prompt("New value?");
    if (value == null) return;
    await fetch(`/api/secrets/${id}/rotate`, { method: "POST", body: JSON.stringify({ value }) });
    await load();
  }

  return (
    <section>
      <h2>{envName}</h2>
      <ul>
        {secrets.map((s) => (
          <li key={s.id}>
            <strong>{s.key}</strong>
            {s.needsRotation && <span style={{ color: "crimson" }}> ⚠ needs rotation</span>}
            <button onClick={() => reveal(s.id)}>reveal</button>
            <button onClick={() => rotate(s.id)}>rotate</button>
            {revealed[s.id] && <code> {revealed[s.id]}</code>}
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `pnpm build`
Expected: compiles with no type errors.

- [ ] **Step 4: Manual smoke test**

With a seeded project + secrets and a dev session, confirm secrets list, reveal fetches the plaintext, rotate creates a new version, and a flagged secret shows the "needs rotation" badge.

- [ ] **Step 5: Commit**

```bash
git add src/app/projects
git commit -m "feat: project detail UI with reveal, rotate, and rotation badge"
```

---

# Phase 9 — Deployment & operations docs

### Task 9.1: Dockerfile, KEK provisioning, and Dokploy runbook

**Files:**
- Create: `Dockerfile`
- Create: `docs/DEPLOY.md`

**Interfaces:**
- Produces: a production container build and a written runbook covering KEK generation, mounting it as a Docker secret in Dokploy, running migrations, and the required environment variables.

- [ ] **Step 1: Write `Dockerfile`**

```dockerfile
FROM node:20-slim AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM base AS run
ENV NODE_ENV=production
COPY --from=build /app/.next ./.next
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/src/lib/db ./src/lib/db
EXPOSE 3000
CMD ["pnpm", "start"]
```

- [ ] **Step 2: Write `docs/DEPLOY.md`**

````markdown
# Deploying on Dokploy

## 1. Generate the master key (KEK)
Run once, offline:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Store the output as a **mounted file secret** in Dokploy (Advanced → Volumes /
Secrets), mounted at `/run/secrets/kek.b64`. Do NOT put it in a plain env var.
Keep an offline backup — losing the KEK makes every stored secret unrecoverable.

## 2. Environment variables
- `KEK_FILE=/run/secrets/kek.b64`
- `DATABASE_URL=postgres://...`  (Dokploy-managed Postgres)
- `COMPANY_DOMAIN=yourcompany.com`
- `AUTH_SECRET=` (generate: `openssl rand -base64 32`)
- `AUTH_GOOGLE_ID=` / `AUTH_GOOGLE_SECRET=` (Google Cloud OAuth client)
- `AUTH_URL=https://secrets.yourcompany.com`

## 3. Google OAuth setup
Create an OAuth client (type: Web). Authorized redirect URI:
`https://secrets.yourcompany.com/api/auth/callback/google`.

## 4. Run migrations on deploy
As a post-deploy command: `pnpm db:migrate`.

## 5. First login = owner
The first person to sign in with a company Google account becomes org `owner`
automatically and can grant everyone else.
````

- [ ] **Step 3: Verify the image builds**

Run: `docker build -t secrets-manager .`
Expected: image builds successfully.

- [ ] **Step 4: Verify the full test suite still passes**

Run: `pnpm test`
Expected: all phases' tests PASS.

- [ ] **Step 5: Commit**

```bash
git add Dockerfile docs/DEPLOY.md
git commit -m "docs: Dockerfile and Dokploy deployment runbook"
```

---

## Notes on things intentionally deferred (YAGNI)

- **Email notifications on revoke.** The `needs_rotation` flag surfaces in the UI badge and the audit log; wiring an email/Slack notifier is a later enhancement.
- **Per-provider automatic upstream rotation.** Out of scope for v1 by design — humans rotate upstream and paste the new value.
- **KEK rotation tooling.** The schema supports it (re-wrap DEKs), but a rotation command is deferred.
- **Cloud KMS integration.** The envelope design leaves the door open (swap the wrap/unwrap in `envelope.ts` for KMS calls) with no data migration; not built now.
