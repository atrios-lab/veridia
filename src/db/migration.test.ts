import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

// The upgrade this change ships, rehearsed against Postgres in process: a
// database that already has a user, taken through the migration that makes
// the office column mandatory. The generated SQL was a single ADD COLUMN
// NOT NULL, which fails exactly here, so this is the test that would have
// caught it before production did.

const BASE = "drizzle/0000_parallel_mariko_yashida.sql";
const SCOPE = "drizzle/0001_regular_human_torch.sql";

let client: PGlite;

async function run(file: string) {
  for (const statement of readFileSync(file, "utf8").split(
    "--> statement-breakpoint",
  )) {
    if (statement.trim()) await client.exec(statement);
  }
}

before(async () => {
  client = new PGlite();
  await run(BASE);
  // A user created before the office column existed.
  await client.exec(`
    INSERT INTO "user" (id, name, email, email_verified, role)
    VALUES ('antigo', 'Administrador', 'atrios@exemplo.com', true, 'admin')
  `);
});

after(async () => {
  await client.close();
});

test("the existing user survives with the default office filled in", async () => {
  await run(SCOPE);

  const { rows } = await client.query<{ email: string; tenant_slug: string }>(
    `SELECT email, tenant_slug FROM "user"`,
  );
  assert.equal(rows.length, 1, "o usuário existente não pode sumir");
  assert.equal(rows[0].email, "atrios@exemplo.com");
  assert.equal(rows[0].tenant_slug, "cartorio-marinho");
});

test("after the migration a user without an office is refused", async () => {
  await assert.rejects(
    client.exec(`
      INSERT INTO "user" (id, name, email, email_verified, role)
      VALUES ('novo', 'Sem serventia', 'ninguem@exemplo.com', true, 'staff')
    `),
    /tenant_slug/,
  );
});
