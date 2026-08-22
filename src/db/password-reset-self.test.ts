import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { and, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import * as authSchema from "./auth-schema.ts";

// The one decision behind "esqueci minha senha": who gets a link. The action
// itself (src/app/admin/esqueci-senha/actions.ts) needs a request context this
// suite does not build, so what is asserted here is the lookup it runs, the
// same store-level approach deactivate-account.test.ts takes. Every case that
// must NOT receive a link is a separate account in the fixture, because the
// screen says the same sentence to all of them: if this query ever widens,
// nothing in the UI would show it.

const MIGRATIONS_DIR = "drizzle";
const OFFICE = "cartorio-a";
const OTHER_OFFICE = "cartorio-b";

type Db = ReturnType<typeof drizzle<typeof authSchema>>;

// Built through a named function, not inline: `ReturnType<typeof buildAuth>`
// keeps the additional user fields (role, tenantSlug) in the inferred type,
// which a bare `ReturnType<typeof betterAuth>` drops. Same shape as
// deactivate-account.test.ts.
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

  const ctx = await auth.$context;
  const create = (email: string, tenantSlug: string) =>
    ctx.internalAdapter.createUser({
      email,
      name: "Escrevente",
      emailVerified: true,
      role: "staff",
      tenantSlug,
    });

  await create("ativa@exemplo.com", OFFICE);
  const disabled = await create("desativada@exemplo.com", OFFICE);
  await create("outra-serventia@exemplo.com", OTHER_OFFICE);

  await db
    .update(authSchema.user)
    .set({ disabledAt: new Date() })
    .where(eq(authSchema.user.id, disabled.id));
});

after(async () => {
  await client.close();
});

/** The action's own lookup: e-mail, office and "not deactivated", together. */
async function findResettable(email: string, tenantSlug: string) {
  const [row] = await db
    .select({ id: authSchema.user.id, email: authSchema.user.email })
    .from(authSchema.user)
    .where(
      and(
        eq(authSchema.user.email, email),
        eq(authSchema.user.tenantSlug, tenantSlug),
        isNull(authSchema.user.disabledAt),
      ),
    );
  return row ?? null;
}

test("conta ativa da serventia recebe o link", async () => {
  const found = await findResettable("ativa@exemplo.com", OFFICE);
  assert.equal(found?.email, "ativa@exemplo.com");
});

test("e-mail sem conta nenhuma não recebe link", async () => {
  assert.equal(await findResettable("ninguem@exemplo.com", OFFICE), null);
});

test("conta desativada não recupera acesso por formulário anônimo", async () => {
  assert.equal(await findResettable("desativada@exemplo.com", OFFICE), null);
});

test("conta de outra serventia não recebe link neste domínio", async () => {
  assert.equal(
    await findResettable("outra-serventia@exemplo.com", OFFICE),
    null,
  );
  // E existe mesmo, no domínio dela: o filtro é o tenant, não o endereço.
  const own = await findResettable("outra-serventia@exemplo.com", OTHER_OFFICE);
  assert.equal(own?.email, "outra-serventia@exemplo.com");
});

test("o e-mail digitado é normalizado como no cadastro da conta", async () => {
  const typed = "  Ativa@Exemplo.COM  ";
  const normalized = typed.trim().toLowerCase();
  const found = await findResettable(normalized, OFFICE);
  assert.equal(found?.email, "ativa@exemplo.com");
});
