import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { APIError } from "better-auth/api";
import { drizzle } from "drizzle-orm/pglite";
import * as authSchema from "./auth-schema.ts";

// First-access invite (Entrega 5), against Postgres in process, same
// approach as session-revocation.test.ts. The claim under test is the one
// design.md settled on: resetPassword is the invite primitive, it works on a
// user that has no password yet, and an expired token is refused.

const MIGRATIONS_DIR = "drizzle";
const EMAIL = "convidada@exemplo.com";
const TENANT = "cartorio-marinho";
const RESET_TOKEN_EXPIRES_IN = 60 * 60 * 48;

type Db = ReturnType<typeof drizzle<typeof authSchema>>;

function buildAuth(database: Db) {
  return betterAuth({
    database: drizzleAdapter(database, { provider: "pg", schema: authSchema }),
    secret: "segredo-somente-de-teste-sem-valor-nenhum-fora-daqui",
    baseURL: "http://localhost:3000",
    user: { additionalFields: authSchema.USER_ADDITIONAL_FIELDS },
    emailAndPassword: {
      enabled: true,
      resetPasswordTokenExpiresIn: RESET_TOKEN_EXPIRES_IN,
    },
  });
}

let client: PGlite;
let auth: ReturnType<typeof buildAuth>;
let userId: string;

before(async () => {
  client = new PGlite();
  const db = drizzle(client, { schema: authSchema });

  for (const file of readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      if (statement.trim()) await client.exec(statement);
    }
  }

  auth = buildAuth(db);

  // No linkAccount here, on purpose: an invited user has no credential
  // account yet, same as one created by scripts/seed-admin.ts followed by
  // scripts/invite-admin.ts rather than by hand with a chosen password.
  const ctx = await auth.$context;
  const created = await ctx.internalAdapter.createUser({
    email: EMAIL,
    name: "Convidada Exemplo",
    emailVerified: true,
    role: "staff",
    tenantSlug: TENANT,
  });
  userId = created.id;
});

after(async () => {
  await client.close();
});

async function issueToken(expiresAt: Date): Promise<string> {
  const token = crypto.randomUUID();
  const ctx = await auth.$context;
  await ctx.internalAdapter.createVerificationValue({
    identifier: `reset-password:${token}`,
    value: userId,
    expiresAt,
  });
  return token;
}

test("a valid invite token lets a passwordless user set a password and sign in", async () => {
  const token = await issueToken(
    new Date(Date.now() + RESET_TOKEN_EXPIRES_IN * 1000),
  );

  await auth.api.resetPassword({
    body: { token, newPassword: "primeira-senha-escolhida" },
  });

  const session = await auth.api.signInEmail({
    body: { email: EMAIL, password: "primeira-senha-escolhida" },
  });
  assert.equal(session.user.email, EMAIL);
});

test("an expired invite token is refused, and sets no password", async () => {
  const token = await issueToken(new Date(Date.now() - 1000));

  await assert.rejects(() =>
    auth.api.resetPassword({
      body: { token, newPassword: "nao-deveria-colar" },
    }),
  );

  try {
    await auth.api.signInEmail({
      body: { email: EMAIL, password: "nao-deveria-colar" },
    });
    assert.fail("um token vencido nao deveria ter deixado a senha valer");
  } catch (error) {
    assert.ok((error as APIError).status);
  }
});
