import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { and, eq, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import {
  deleteResetTokensWith,
  issueResetTokenWith,
} from "../lib/auth-tokens.ts";
import * as authSchema from "./auth-schema.ts";

// Deleting an account that never accessed the panel
// (excluir-conta-nunca-acessada), same store-level approach as
// deactivate-account.test.ts: what is asserted here is exactly what
// deleteAccount (src/app/admin/(dashboard)/usuarios/actions.ts) does to the
// rows, not the Next.js action wrapper, which needs a request context this
// suite does not build.

const MIGRATIONS_DIR = "drizzle";
const PASSWORD = "senha-de-teste";
const TENANT = "tenant-delete-account";

type Db = ReturnType<typeof drizzle<typeof authSchema>>;

function buildAuth(database: Db) {
  return betterAuth({
    database: drizzleAdapter(database, { provider: "pg", schema: authSchema }),
    secret: "segredo-somente-de-teste-sem-valor-nenhum-fora-daqui",
    baseURL: "http://localhost:3000",
    user: { additionalFields: authSchema.USER_ADDITIONAL_FIELDS },
    emailAndPassword: { enabled: true, resetPasswordTokenExpiresIn: 60 * 60 },
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

/** An invited account: a `user` row and an invite token, no credential. */
async function invite(email: string) {
  const ctx = await auth.$context;
  const created = await ctx.internalAdapter.createUser({
    email,
    name: "Convidada",
    emailVerified: true,
    role: "staff",
    tenantSlug: TENANT,
  });
  await issueResetTokenWith(ctx, created.id);
  return created.id;
}

async function setOwnPassword(userId: string) {
  const ctx = await auth.$context;
  await ctx.internalAdapter.linkAccount({
    userId,
    providerId: "credential",
    accountId: userId,
    password: await ctx.password.hash(PASSWORD),
  });
}

/** The join findOwnAccount runs to decide whether the account ever entered. */
async function credentialOf(userId: string) {
  const [row] = await db
    .select({ credentialId: authSchema.account.id })
    .from(authSchema.user)
    .leftJoin(
      authSchema.account,
      and(
        eq(authSchema.account.userId, authSchema.user.id),
        eq(authSchema.account.providerId, "credential"),
      ),
    )
    .where(eq(authSchema.user.id, userId));
  return row?.credentialId ?? null;
}

async function resetTokensOf(userId: string) {
  return db
    .select({ identifier: authSchema.verification.identifier })
    .from(authSchema.verification)
    .where(
      and(
        eq(authSchema.verification.value, userId),
        like(authSchema.verification.identifier, "reset-password:%"),
      ),
    );
}

/** What deleteAccount writes, in the order it writes it. */
async function deleteAccountRows(userId: string) {
  const ctx = await auth.$context;
  await deleteResetTokensWith(ctx, userId);
  await db.delete(authSchema.user).where(eq(authSchema.user.id, userId));
}

test("an invited account has no credential, one that set a password has", async () => {
  const invited = await invite("convidada@exemplo.com");
  assert.equal(await credentialOf(invited), null);

  await setOwnPassword(invited);
  assert.notEqual(await credentialOf(invited), null);
});

test("deleting removes the account and the invite it was still holding", async () => {
  const userId = await invite("some@exemplo.com");
  assert.equal((await resetTokensOf(userId)).length, 1);

  await deleteAccountRows(userId);

  const rows = await db
    .select({ id: authSchema.user.id })
    .from(authSchema.user)
    .where(eq(authSchema.user.id, userId));
  assert.equal(rows.length, 0);

  // `verification` has no foreign key to `user`, so nothing else would have
  // taken this row: an unusable link pointing at a user that no longer
  // exists is exactly what the explicit delete is for.
  assert.equal((await resetTokensOf(userId)).length, 0);
});

test("the e-mail is free again for a new invite", async () => {
  const email = "reconvidada@exemplo.com";
  const userId = await invite(email);
  await deleteAccountRows(userId);

  const ctx = await auth.$context;
  assert.equal(await ctx.internalAdapter.findUserByEmail(email), null);

  // The unique index on user.email is what used to burn the address for
  // good; inviting it again has to be accepted, not rejected.
  const again = await invite(email);
  assert.notEqual(again, userId);
});

test("deleting an account that has one takes its credential and sessions with it", async () => {
  // Not a path deleteAccount allows: the guard refuses an account with a
  // credential. Asserted here because it is why the action deletes only the
  // `user` row and leaves `session`/`account` to the cascade.
  const email = "logada@exemplo.com";
  const userId = await invite(email);
  await setOwnPassword(userId);

  const response = await auth.api.signInEmail({
    body: { email, password: PASSWORD },
    asResponse: true,
  });
  assert.ok(response.headers.get("set-cookie"));

  await db.delete(authSchema.user).where(eq(authSchema.user.id, userId));

  const sessions = await db
    .select({ id: authSchema.session.id })
    .from(authSchema.session)
    .where(eq(authSchema.session.userId, userId));
  const accounts = await db
    .select({ id: authSchema.account.id })
    .from(authSchema.account)
    .where(eq(authSchema.account.userId, userId));
  assert.equal(sessions.length, 0);
  assert.equal(accounts.length, 0);
});
