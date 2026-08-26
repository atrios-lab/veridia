import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { APIError } from "better-auth/api";
import { and, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import * as authSchema from "../db/auth-schema.ts";
import {
  emailChangeIdentifier,
  issueEmailChangeTokenWith,
  issueResetTokenWith,
  parseEmailChangeValue,
} from "./auth-tokens.ts";

// Postgres in process, same approach as src/db/invite.test.ts. The claim
// under test is the one design.md and specs/admin-auth settle on: reissuing
// a token (reenviar convite, disparar nova senha) invalidates whatever was
// issued before it, for that same account.

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
let db: Db;
let auth: ReturnType<typeof buildAuth>;
let userId: string;

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

test("reissuing a token invalidates the previous one, and the new one works", async () => {
  const ctx = await auth.$context;
  const first = await issueResetTokenWith(ctx, userId);
  const second = await issueResetTokenWith(ctx, userId);
  assert.notEqual(first, second);

  try {
    await auth.api.resetPassword({
      body: { token: first, newPassword: "nao-deveria-colar" },
    });
    assert.fail("o primeiro token deveria ter sido invalidado pelo segundo");
  } catch (error) {
    assert.ok((error as APIError).status);
  }

  await auth.api.resetPassword({
    body: { token: second, newPassword: "senha-nova-valida" },
  });
  const session = await auth.api.signInEmail({
    body: { email: EMAIL, password: "senha-nova-valida" },
  });
  assert.equal(session.user.email, EMAIL);
});

test("issuing a token for one user never touches another user's token", async () => {
  const ctx = await auth.$context;
  const other = await ctx.internalAdapter.createUser({
    email: "outra@exemplo.com",
    name: "Outra Pessoa",
    emailVerified: true,
    role: "staff",
    tenantSlug: TENANT,
  });

  const mine = await issueResetTokenWith(ctx, userId);
  const theirs = await issueResetTokenWith(ctx, other.id);
  await issueResetTokenWith(ctx, userId); // reissue mine again

  // theirs is still the live token for the other account
  await auth.api.resetPassword({
    body: { token: theirs, newPassword: "senha-da-outra-pessoa" },
  });
  const session = await auth.api.signInEmail({
    body: { email: "outra@exemplo.com", password: "senha-da-outra-pessoa" },
  });
  assert.equal(session.user.email, "outra@exemplo.com");

  try {
    await auth.api.resetPassword({
      body: { token: mine, newPassword: "nao-deveria-colar" },
    });
    assert.fail("o primeiro token da minha conta deveria ter sido invalidado");
  } catch (error) {
    assert.ok((error as APIError).status);
  }
});

async function verificationRows(prefix: string, userId: string) {
  return db
    .select({
      identifier: authSchema.verification.identifier,
      value: authSchema.verification.value,
    })
    .from(authSchema.verification)
    .where(
      and(
        like(authSchema.verification.identifier, `${prefix}%`),
        like(authSchema.verification.value, `${userId}%`),
      ),
    );
}

test("asking for a second e-mail change replaces the first", async () => {
  const ctx = await auth.$context;
  const first = await issueEmailChangeTokenWith(ctx, userId, "um@exemplo.com");
  const second = await issueEmailChangeTokenWith(
    ctx,
    userId,
    "dois@exemplo.com",
  );
  assert.notEqual(first, second);

  const rows = await verificationRows("change-email:", userId);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].identifier, emailChangeIdentifier(second));
  assert.equal(parseEmailChangeValue(rows[0].value)?.email, "dois@exemplo.com");
});

test("an e-mail change and a password link coexist: neither cancels the other", async () => {
  const ctx = await auth.$context;
  await issueEmailChangeTokenWith(ctx, userId, "coexiste@exemplo.com");
  await issueResetTokenWith(ctx, userId);

  // Separate prefixes exist exactly so that issuing one leaves the other
  // alone: an operator waiting on a new password should not lose the
  // address change they asked for an hour earlier.
  assert.equal((await verificationRows("change-email:", userId)).length, 1);
  assert.equal((await verificationRows("reset-password:", userId)).length, 1);

  await issueEmailChangeTokenWith(ctx, userId, "ainda-coexiste@exemplo.com");
  assert.equal((await verificationRows("reset-password:", userId)).length, 1);
});

test("the stored value survives an address that has its own punctuation", () => {
  const parsed = parseEmailChangeValue("user-123|maria+cartorio@exemplo.com");
  assert.deepEqual(parsed, {
    userId: "user-123",
    email: "maria+cartorio@exemplo.com",
  });
});

test("a malformed value reads as nothing, never as half an answer", () => {
  assert.equal(parseEmailChangeValue("sem-separador"), null);
  assert.equal(parseEmailChangeValue("|so-email@exemplo.com"), null);
  assert.equal(parseEmailChangeValue("so-user-id|"), null);
});
