import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { and, count, eq, isNull, ne } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { isAccountDisabled, isLastActiveAdmin } from "../core/auth/roles.ts";
import * as authSchema from "./auth-schema.ts";

// Deactivate/reactivate access (deactivate-panel-accounts), same store-level
// approach as tenant-scope.test.ts and session-revocation.test.ts: what is
// asserted here is exactly what deactivateAccount/reactivateAccount
// (src/app/admin/(dashboard)/usuarios/actions.ts) do to the row, to open
// sessions, and to the next sign-in attempt — not the Next.js action
// wrapper itself, which needs a request context this suite does not build.

const MIGRATIONS_DIR = "drizzle";
const PASSWORD = "senha-de-teste";

type Db = ReturnType<typeof drizzle<typeof authSchema>>;

function buildAuth(database: Db) {
  return betterAuth({
    database: drizzleAdapter(database, { provider: "pg", schema: authSchema }),
    secret: "segredo-somente-de-teste-sem-valor-nenhum-fora-daqui",
    baseURL: "http://localhost:3000",
    user: { additionalFields: authSchema.USER_ADDITIONAL_FIELDS },
    emailAndPassword: { enabled: true },
  });
}

let client: PGlite;
let db: Db;
let auth: ReturnType<typeof buildAuth>;

before(async () => {
  client = new PGlite();
  db = drizzle(client, { schema: authSchema });

  for (const file of readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      if (statement.trim()) await client.exec(statement);
    }
  }

  auth = buildAuth(db);
});

after(async () => {
  await client.close();
});

async function createAdmin(tenantSlug: string, email: string) {
  const ctx = await auth.$context;
  const created = await ctx.internalAdapter.createUser({
    email,
    name: "Registradora",
    emailVerified: true,
    role: "admin",
    tenantSlug,
  });
  await ctx.internalAdapter.linkAccount({
    userId: created.id,
    providerId: "credential",
    accountId: created.id,
    password: await ctx.password.hash(PASSWORD),
  });
  return created.id;
}

/** The exact count deactivateAccount runs before deciding, scoped by office. */
async function otherActiveAdmins(tenantSlug: string, targetId: string) {
  const [{ value }] = await db
    .select({ value: count() })
    .from(authSchema.user)
    .where(
      and(
        eq(authSchema.user.tenantSlug, tenantSlug),
        eq(authSchema.user.role, "admin"),
        isNull(authSchema.user.disabledAt),
        ne(authSchema.user.id, targetId),
      ),
    );
  return value;
}

test("the only active admin of an office is the last one", async () => {
  const solo = await createAdmin("tenant-solo-admin", "solo@exemplo.com");
  assert.ok(
    isLastActiveAdmin(
      "admin",
      await otherActiveAdmins("tenant-solo-admin", solo),
    ),
  );
});

test("an admin with an active peer is not the last one, but becomes it once the peer is deactivated", async () => {
  const tenant = "tenant-pair-admin";
  const first = await createAdmin(tenant, "first@exemplo.com");
  const second = await createAdmin(tenant, "second@exemplo.com");

  assert.equal(
    isLastActiveAdmin("admin", await otherActiveAdmins(tenant, first)),
    false,
  );

  // What deactivateAccount writes to the row.
  await db
    .update(authSchema.user)
    .set({ disabledAt: new Date() })
    .where(eq(authSchema.user.id, first));

  assert.ok(
    isLastActiveAdmin("admin", await otherActiveAdmins(tenant, second)),
  );
});

test("deactivating ends every session already open for that account", async () => {
  const tenant = "tenant-session-revocation";
  const email = "logado@exemplo.com";
  const userId = await createAdmin(tenant, email);

  const response = await auth.api.signInEmail({
    body: { email, password: PASSWORD },
    asResponse: true,
  });
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie);
  assert.ok(await auth.api.getSession({ headers: new Headers({ cookie }) }));

  // What deactivateAccount does to the row and to open sessions.
  await db
    .update(authSchema.user)
    .set({ disabledAt: new Date() })
    .where(eq(authSchema.user.id, userId));
  await db
    .delete(authSchema.session)
    .where(eq(authSchema.session.userId, userId));

  assert.equal(
    await auth.api.getSession({ headers: new Headers({ cookie }) }),
    null,
  );
});

test("a disabled account can still authenticate at the Better Auth layer, which is exactly why getSession() checks disabledAt itself", async () => {
  const tenant = "tenant-disabled-signin";
  const email = "saiu@exemplo.com";
  const userId = await createAdmin(tenant, email);
  await db
    .update(authSchema.user)
    .set({ disabledAt: new Date() })
    .where(eq(authSchema.user.id, userId));

  // Better Auth has no notion of disabledAt, so the password still works.
  const response = await auth.api.signInEmail({
    body: { email, password: PASSWORD },
    asResponse: true,
  });
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie, "o login por si só não sabe de disabledAt");

  const session = await auth.api.getSession({
    headers: new Headers({ cookie }),
  });
  assert.ok(session);
  // The guard src/lib/session.ts applies on top of this exact field.
  assert.ok(isAccountDisabled(session.user.disabledAt));
});

test("reactivating clears disabledAt and leaves the existing password working", async () => {
  const tenant = "tenant-reactivate";
  const email = "volta@exemplo.com";
  const userId = await createAdmin(tenant, email);
  await db
    .update(authSchema.user)
    .set({ disabledAt: new Date() })
    .where(eq(authSchema.user.id, userId));

  // What reactivateAccount does: clears disabledAt, nothing about the
  // credential.
  await db
    .update(authSchema.user)
    .set({ disabledAt: null })
    .where(eq(authSchema.user.id, userId));

  const [row] = await db
    .select({ disabledAt: authSchema.user.disabledAt })
    .from(authSchema.user)
    .where(eq(authSchema.user.id, userId));
  assert.equal(row.disabledAt, null);

  const session = await auth.api.signInEmail({
    body: { email, password: PASSWORD },
  });
  assert.equal(session.user.email, email);
});
