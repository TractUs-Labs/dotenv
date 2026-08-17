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
