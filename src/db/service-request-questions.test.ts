import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

// service_request_questions, against Postgres in process. What belongs
// here is the shape of the table — the cascade from a deleted request to
// its thread, and that the index the two consult screens read through
// actually exists — not the status/validation rules already covered in
// src/core/request/question.test.ts.

const MIGRATIONS_DIR = "drizzle";
const TENANT = "cartorio-marinho";

let client: PGlite;
let userId: string;
let userSequence = 0;

async function insertUser(): Promise<string> {
  userSequence += 1;
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO "user" (id, name, email, tenant_slug, role)
     VALUES (gen_random_uuid()::text, 'Helena Duarte', $2, $1, 'staff')
     RETURNING id`,
    [TENANT, `helena-${userSequence}@exemplo.com`],
  );
  return rows[0].id;
}

let requestSequence = 0;

async function insertServiceRequest(): Promise<string> {
  requestSequence += 1;
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO service_requests
       (tenant_slug, protocol_year, protocol_sequence, protocol_number,
        act_id, attribution, applicant_name, contact, access_key_hash)
     VALUES ($1, 2026, $2, $3, 'rcpn-certidao', 'RCPN', 'Rosa Almeida Fontes',
             'rosa@exemplo.com', 'hash')
     RETURNING id`,
    [
      TENANT,
      requestSequence,
      `REQ.2026.${String(requestSequence).padStart(6, "0")}`,
    ],
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
  userId = await insertUser();
});

after(async () => {
  await client.close();
});

test("a citizen question has no author id", async () => {
  const requestId = await insertServiceRequest();
  const { rows } = await client.query<{
    author_type: string;
    author_id: string | null;
  }>(
    `INSERT INTO service_request_questions (tenant_slug, request_id, author_type, author_id, body)
     VALUES ($1, $2, 'citizen', NULL, 'O documento precisa ser autenticado?')
     RETURNING author_type, author_id`,
    [TENANT, requestId],
  );
  assert.equal(rows[0].author_type, "citizen");
  assert.equal(rows[0].author_id, null);
});

test("a staff reply carries the operator who wrote it", async () => {
  const requestId = await insertServiceRequest();
  const { rows } = await client.query<{ author_id: string }>(
    `INSERT INTO service_request_questions (tenant_slug, request_id, author_type, author_id, body)
     VALUES ($1, $2, 'staff', $3, 'Serve cópia simples, desde que legível.')
     RETURNING author_id`,
    [TENANT, requestId, userId],
  );
  assert.equal(rows[0].author_id, userId);
});

test("the thread follows the request when it is deleted", async () => {
  const requestId = await insertServiceRequest();
  await client.query(
    `INSERT INTO service_request_questions (tenant_slug, request_id, author_type, author_id, body)
     VALUES ($1, $2, 'citizen', NULL, 'Pergunta 1'),
            ($1, $2, 'staff', $3, 'Resposta 1')`,
    [TENANT, requestId, userId],
  );

  const before = await client.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM service_request_questions WHERE request_id = $1",
    [requestId],
  );
  assert.equal(before.rows[0].count, "2");

  await client.query("DELETE FROM service_requests WHERE id = $1", [requestId]);

  const after = await client.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM service_request_questions WHERE request_id = $1",
    [requestId],
  );
  assert.equal(after.rows[0].count, "0");
});

test("deleting the operator leaves their reply, orphaned", async () => {
  const requestId = await insertServiceRequest();
  const soloUser = await insertUser();
  await client.query(
    `INSERT INTO service_request_questions (tenant_slug, request_id, author_type, author_id, body)
     VALUES ($1, $2, 'staff', $3, 'Resposta')`,
    [TENANT, requestId, soloUser],
  );

  await client.query('DELETE FROM "user" WHERE id = $1', [soloUser]);

  const { rows } = await client.query<{ author_id: string | null }>(
    "SELECT author_id FROM service_request_questions WHERE request_id = $1",
    [requestId],
  );
  assert.equal(rows[0].author_id, null);
});

test("the thread index covers request and created_at", async () => {
  const { rows } = await client.query<{ indexname: string }>(
    "SELECT indexname FROM pg_indexes WHERE tablename = 'service_request_questions'",
  );
  assert.ok(
    rows
      .map((r) => r.indexname)
      .includes("service_request_questions_request_created_at"),
  );
});
