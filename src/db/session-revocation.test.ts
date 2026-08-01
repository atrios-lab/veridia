import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import * as authSchema from "./auth-schema.ts";

// Postgres in process, seeded with the committed migration. No real database,
// no secret, nothing to configure in CI, and the claim under test is the real
// one: a session removed from the store is gone on the next request.

const MIGRATIONS_DIR = "drizzle";
const CREDENTIALS = { email: "admin@exemplo.com", password: "senha-de-teste" };

type Db = ReturnType<typeof drizzle<typeof authSchema>>;

function buildAuth(database: Db) {
  return betterAuth({
    database: drizzleAdapter(database, { provider: "pg", schema: authSchema }),
    secret: "segredo-somente-de-teste-sem-valor-nenhum-fora-daqui",
    baseURL: "http://localhost:3000",
    // Sign up is enabled here only to create the fixture. The application
    // config keeps it disabled; see src/lib/auth.ts.
    emailAndPassword: { enabled: true },
  });
}

let client: PGlite;
let auth: ReturnType<typeof buildAuth>;
let db: Db;

before(async () => {
  client = new PGlite();
  db = drizzle(client, { schema: authSchema });

  // Running the committed SQL is also a smoke test of the migration itself.
  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) =>
    f.endsWith(".sql"),
  )) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      if (statement.trim()) await client.exec(statement);
    }
  }

  auth = buildAuth(db);

  await auth.api.signUpEmail({
    body: { ...CREDENTIALS, name: "Administrador" },
  });
});

after(async () => {
  await client.close();
});

/** Signs in and returns the Cookie header a browser would send back. */
async function signInAndGetCookie(): Promise<string> {
  const response = await auth.api.signInEmail({
    body: CREDENTIALS,
    asResponse: true,
  });
  const setCookie = response.headers.get("set-cookie");
  assert.ok(setCookie, "login deveria devolver o cookie de sessão");
  return setCookie.split(";")[0];
}

function requestWith(cookie: string) {
  return auth.api.getSession({ headers: new Headers({ cookie }) });
}

test("login creates a session in the database", async () => {
  const cookie = await signInAndGetCookie();
  const session = await requestWith(cookie);
  assert.equal(session?.user.email, CREDENTIALS.email);

  const rows = await db.select().from(authSchema.session);
  assert.ok(rows.length >= 1);
});

test("revoking the session drops access on the next request", async () => {
  const cookie = await signInAndGetCookie();
  const before = await requestWith(cookie);
  assert.ok(before, "a sessão deveria valer antes da revogação");

  await db
    .delete(authSchema.session)
    .where(eq(authSchema.session.id, before.session.id));

  // Same cookie, next request: the store is the only authority.
  assert.equal(await requestWith(cookie), null);
});

/** Runs a login expected to fail and returns only what the caller can see. */
async function failedSignIn(email: string, password: string) {
  try {
    await auth.api.signInEmail({ body: { email, password } });
    assert.fail("este login deveria ter falhado");
  } catch (error) {
    const apiError = error as APIError;
    return { status: apiError.status, message: apiError.body?.message };
  }
}

test("wrong password and unknown user fail the same way", async () => {
  const wrongPassword = await failedSignIn(CREDENTIALS.email, "errada");
  const unknownUser = await failedSignIn("ninguem@exemplo.com", "errada");

  assert.deepEqual(wrongPassword, unknownUser);
});
