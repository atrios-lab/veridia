import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

// office_publications against Postgres in process: the four states are
// computed in src/core/publications/state.ts, never stored, so what belongs
// here is the shape of the table itself — nullable dates, the index used by
// the public query, and that inserting the four kinds of row it holds works.

const MIGRATIONS_DIR = "drizzle";

let client: PGlite;

async function insertPublication(
  tenantSlug: string,
  overrides: {
    kind?: string;
    title?: string;
    publishAt?: string | null;
    expireAt?: string | null;
    archivedAt?: string | null;
  } = {},
): Promise<string> {
  const {
    kind = "notice",
    title = "Aviso de teste",
    publishAt = null,
    expireAt = null,
    archivedAt = null,
  } = overrides;
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO office_publications
       (tenant_slug, kind, title, body, publish_at, expire_at, archived_at)
     VALUES ($1, $2, $3, 'Corpo do texto.', $4, $5, $6)
     RETURNING id`,
    [tenantSlug, kind, title, publishAt, expireAt, archivedAt],
  );
  return rows[0].id;
}

before(async () => {
  client = new PGlite();
  for (const file of readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      if (statement.trim()) await client.exec(statement);
    }
  }
});

after(async () => {
  await client.close();
});

test("a draft has no entry date", async () => {
  const id = await insertPublication("cartorio-marinho", {
    kind: "marriageBanns",
    title: "Proclama rascunho",
  });
  const { rows } = await client.query<{ publish_at: string | null }>(
    "SELECT publish_at FROM office_publications WHERE id = $1",
    [id],
  );
  assert.equal(rows[0].publish_at, null);
});

test("a scheduled publication has entry and exit dates, not archived", async () => {
  const id = await insertPublication("cartorio-marinho", {
    kind: "notice",
    publishAt: "2026-09-01",
    expireAt: "2026-09-15",
  });
  const { rows } = await client.query<{
    publish_at: string;
    expire_at: string;
    archived_at: string | null;
  }>(
    `SELECT publish_at::text, expire_at::text, archived_at
     FROM office_publications WHERE id = $1`,
    [id],
  );
  assert.equal(rows[0].publish_at, "2026-09-01");
  assert.equal(rows[0].expire_at, "2026-09-15");
  assert.equal(rows[0].archived_at, null);
});

test("manual archiving stamps archived_at", async () => {
  const id = await insertPublication("cartorio-marinho", {
    publishAt: "2026-08-01",
    expireAt: "2026-08-16",
  });
  await client.query(
    "UPDATE office_publications SET archived_at = now() WHERE id = $1",
    [id],
  );
  const { rows } = await client.query<{ archived_at: string | null }>(
    "SELECT archived_at FROM office_publications WHERE id = $1",
    [id],
  );
  assert.notEqual(rows[0].archived_at, null);
});

test("live publications for a tenant are ordered by entry date, most recent first", async () => {
  const tenantSlug = "tabelionato-aurora";
  await insertPublication(tenantSlug, {
    title: "Mais antiga",
    publishAt: "2026-08-01",
    expireAt: "2026-09-01",
  });
  await insertPublication(tenantSlug, {
    title: "Mais recente",
    publishAt: "2026-08-05",
    expireAt: "2026-09-05",
  });
  const { rows } = await client.query<{ title: string }>(
    `SELECT title FROM office_publications
     WHERE tenant_slug = $1 AND publish_at IS NOT NULL
     ORDER BY publish_at DESC`,
    [tenantSlug],
  );
  assert.deepEqual(
    rows.map((r) => r.title),
    ["Mais recente", "Mais antiga"],
  );
});

test("publications from one office do not leak into another's query", async () => {
  const { rows } = await client.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM office_publications WHERE tenant_slug = 'cartorio-marinho'",
  );
  // The three cartorio-marinho rows from the earlier tests, not the two
  // filed under tabelionato-aurora above.
  assert.equal(rows[0].count, "3");
});
