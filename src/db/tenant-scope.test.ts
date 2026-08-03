import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/pglite";
import { can, canAccessTenant } from "../core/auth/roles.ts";
import { TENANTS } from "../core/tenant/resolve.ts";
import * as authSchema from "./auth-schema.ts";

// One user per registered office, against Postgres in process. Parameterized
// over the registry: a new office is covered the moment it is registered.
//
// This is the store level of the rule. The browser level would need a real
// database in CI, which the foundation ruled out on purpose, so what is
// asserted here is that the office round trips into the session and that the
// decision made from it is the same one the panel guard makes.

const MIGRATIONS_DIR = "drizzle";
const PASSWORD = "senha-de-teste";
const slugs = Object.keys(TENANTS);

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
let auth: ReturnType<typeof buildAuth>;

const emailOf = (slug: string) => `admin@${slug}.exemplo.com`;

before(async () => {
  client = new PGlite();
  auth = buildAuth(drizzle(client, { schema: authSchema }));

  for (const file of readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      if (statement.trim()) await client.exec(statement);
    }
  }

  const ctx = await auth.$context;
  for (const slug of slugs) {
    const created = await ctx.internalAdapter.createUser({
      email: emailOf(slug),
      name: "Administrador",
      emailVerified: true,
      role: "admin",
      tenantSlug: slug,
    });
    await ctx.internalAdapter.linkAccount({
      userId: created.id,
      providerId: "credential",
      accountId: created.id,
      password: await ctx.password.hash(PASSWORD),
    });
  }
});

after(async () => {
  await client.close();
});

async function signIn(slug: string) {
  const response = await auth.api.signInEmail({
    body: { email: emailOf(slug), password: PASSWORD },
    asResponse: true,
  });
  const setCookie = response.headers.get("set-cookie");
  assert.ok(setCookie, "login deveria devolver o cookie de sessão");
  return setCookie.split(";")[0];
}

const sessionFor = (cookie: string) =>
  auth.api.getSession({ headers: new Headers({ cookie }) });

test("the session carries the office the user belongs to", async () => {
  for (const slug of slugs) {
    const session = await sessionFor(await signIn(slug));
    assert.equal(session?.user.tenantSlug, slug, slug);
  }
});

test("a user of one office is refused by every other one", async () => {
  for (const slug of slugs) {
    const session = await sessionFor(await signIn(slug));
    assert.ok(session);

    for (const other of slugs) {
      // Exactly the pair of conditions the panel guard applies.
      const allowed: boolean =
        can(session.user.role ?? "", "admin.access") &&
        canAccessTenant(session.user.tenantSlug ?? "", other);
      assert.equal(allowed, slug === other, `${slug} no painel de ${other}`);
    }
  }
});

test("every office has a user, so none is covered by accident", () => {
  assert.ok(slugs.length >= 2);
});

test("the cookie from a refused login does not survive", async () => {
  const cookie = await signIn(slugs[0]);
  assert.ok(await sessionFor(cookie), "a sessão deveria valer antes");

  // What the login action does when the office does not match: it ends the
  // session before answering, so nothing usable is left behind.
  await auth.api.signOut({ headers: new Headers({ cookie }) });

  assert.equal(await sessionFor(cookie), null);
});
