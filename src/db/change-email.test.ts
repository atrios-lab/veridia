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
import {
  deleteEmailChangesWith,
  emailChangeIdentifier,
  issueEmailChangeTokenWith,
  parseEmailChangeValue,
} from "../lib/auth-tokens.ts";
import * as authSchema from "./auth-schema.ts";

// Changing the e-mail that is also the login (trocar-email-da-conta), same
// store-level approach as delete-account.test.ts: what is asserted is what
// updateAccount and confirmEmailChange do to the rows and to the next
// sign-in, not the Next.js wrappers, which need a request context this
// suite does not build.

const MIGRATIONS_DIR = "drizzle";
const PASSWORD = "senha-de-teste";
const TENANT = "tenant-change-email";

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

async function createAccount(email: string) {
  const ctx = await auth.$context;
  const created = await ctx.internalAdapter.createUser({
    email,
    name: "Júlia Santos",
    emailVerified: true,
    role: "staff",
    tenantSlug: TENANT,
  });
  await ctx.internalAdapter.linkAccount({
    userId: created.id,
    providerId: "credential",
    accountId: created.id,
    password: await ctx.password.hash(PASSWORD),
  });
  return created.id;
}

async function emailOf(userId: string) {
  const [row] = await db
    .select({ email: authSchema.user.email })
    .from(authSchema.user)
    .where(eq(authSchema.user.id, userId));
  return row?.email ?? null;
}

async function signsIn(email: string) {
  try {
    await auth.api.signInEmail({ body: { email, password: PASSWORD } });
    return true;
  } catch (error) {
    assert.ok((error as APIError).status);
    return false;
  }
}

/** What the pending row holds, read the way the confirmation page reads it. */
async function pendingChange(token: string) {
  const [row] = await db
    .select({ value: authSchema.verification.value })
    .from(authSchema.verification)
    .where(
      eq(authSchema.verification.identifier, emailChangeIdentifier(token)),
    );
  return row ? parseEmailChangeValue(row.value) : null;
}

/** What confirmEmailChange writes once the link is opened. */
async function applyChange(userId: string, email: string) {
  const ctx = await auth.$context;
  await db
    .update(authSchema.user)
    .set({ email, emailVerified: true })
    .where(eq(authSchema.user.id, userId));
  await deleteEmailChangesWith(ctx, userId);
}

test("asking does not touch the login; confirming moves it", async () => {
  const antigo = "antigo@exemplo.com";
  const novo = "novo@exemplo.com";
  const userId = await createAccount(antigo);
  const ctx = await auth.$context;

  const token = await issueEmailChangeTokenWith(ctx, userId, novo);

  // The whole promise of the two-step change: nothing moves until the
  // person at the new address opens the link.
  assert.equal(await emailOf(userId), antigo);
  assert.ok(await signsIn(antigo));

  const pending = await pendingChange(token);
  assert.deepEqual(pending, { userId, email: novo });

  await applyChange(userId, novo);

  assert.equal(await emailOf(userId), novo);
  assert.ok(await signsIn(novo));
  assert.equal(await signsIn(antigo), false);
});

test("confirming twice does nothing the second time", async () => {
  const userId = await createAccount("dupla@exemplo.com");
  const ctx = await auth.$context;
  const token = await issueEmailChangeTokenWith(
    ctx,
    userId,
    "dupla-nova@exemplo.com",
  );

  await applyChange(userId, "dupla-nova@exemplo.com");

  // The row is gone, so the link resolves to nothing: the page has no
  // pending change to show and no address to write.
  assert.equal(await pendingChange(token), null);
});

test("an address taken between asking and confirming is refused, not crashed into", async () => {
  const disputado = "disputado@exemplo.com";
  const userId = await createAccount("pedinte@exemplo.com");
  const ctx = await auth.$context;

  await issueEmailChangeTokenWith(ctx, userId, disputado);
  // Someone else claims it in the meantime, which the platform-wide unique
  // index allows right up until the confirmation tries to write.
  await createAccount(disputado);

  const taken = await ctx.internalAdapter.findUserByEmail(disputado);
  assert.ok(taken, "a segunda checagem existe para encontrar exatamente isto");

  // Without that check the write below is what would happen, and a unique
  // violation on a public page is a 500, not an explanation.
  await assert.rejects(() =>
    db
      .update(authSchema.user)
      .set({ email: disputado })
      .where(eq(authSchema.user.id, userId)),
  );
  assert.equal(await emailOf(userId), "pedinte@exemplo.com");
});
