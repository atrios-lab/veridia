import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Tables owned by Better Auth. They answer "who is this", nothing else:
// what each role may do lives in src/core/auth, so swapping the library
// never means rewriting authorization.

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  // Business role, read by the pure authorization functions in src/core.
  role: text("role").notNull().default("staff"),
  // The office this user belongs to, and the only one they may act on. It
  // references the config as code registry in src/core/tenant, which is not a
  // table, so there is no foreign key to declare. Not nullable: a user with no
  // office is a state nobody would remember to handle.
  tenantSlug: text("tenant_slug").notNull(),
  // Self-service presence for the support chat console — Disponível, Ocupado
  // ou Ausente. Not access control, just what colleagues see in the transfer
  // list (see add-support-chat/design.md).
  chatStatus: text("chat_status").notNull().default("available"),
  // Which attribution the attendant specializes in, shown next to their name
  // in the transfer list. Optional and set only at invite/seed time — there
  // is no user management screen yet (see add-support-chat/design.md,
  // "Setor do atendente é campo opcional no convite, não uma tela nova").
  chatSector: text("chat_sector"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * The columns above that Better Auth does not know about on its own. It has
 * to be told, or the adapter drops the value on insert and the session never
 * carries it. Declared here, next to the columns, so the two cannot drift.
 */
export const USER_ADDITIONAL_FIELDS = {
  role: { type: "string", input: false, defaultValue: "staff" },
  // No default: which office a user belongs to is never a guess. It is set
  // where the user is created, and validated against the registry there.
  tenantSlug: { type: "string", input: false, required: true },
  chatStatus: { type: "string", input: false, defaultValue: "available" },
  chatSector: { type: "string", input: false, required: false },
} as const;

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  // The cookie carries this token and nothing else. Deleting the row is what
  // makes revocation take effect on the very next request.
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
