import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

// chat_conversations and chat_messages, against Postgres in process. What
// belongs here is the shape of the two tables — the cascade from a deleted
// conversation to its messages, and that the indexes the queue and the
// polling endpoint depend on actually exist — not the domain rules already
// covered in src/core/chat/*.test.ts.

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

async function insertConversation(
  overrides: { status?: string; assignedUserId?: string | null } = {},
): Promise<string> {
  const { status = "waiting", assignedUserId = null } = overrides;
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO chat_conversations
       (tenant_slug, status, citizen_name, citizen_contact, subject,
        citizen_token_hash, assigned_user_id)
     VALUES ($1, $2, 'Rosa Almeida Fontes', 'rosa@exemplo.com', 'Andamento de pedido',
             'hash', $3)
     RETURNING id`,
    [TENANT, status, assignedUserId],
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

test("a new user defaults to available with no sector", async () => {
  const { rows } = await client.query<{
    chat_status: string;
    chat_sector: string | null;
  }>('SELECT chat_status, chat_sector FROM "user" WHERE id = $1', [userId]);
  assert.equal(rows[0].chat_status, "available");
  assert.equal(rows[0].chat_sector, null);
});

test("a conversation waits with no attendant assigned", async () => {
  const id = await insertConversation();
  const { rows } = await client.query<{
    status: string;
    assigned_user_id: string | null;
  }>("SELECT status, assigned_user_id FROM chat_conversations WHERE id = $1", [
    id,
  ]);
  assert.equal(rows[0].status, "waiting");
  assert.equal(rows[0].assigned_user_id, null);
});

test("messages follow the conversation when it is deleted", async () => {
  const id = await insertConversation({
    status: "active",
    assignedUserId: userId,
  });
  await client.query(
    `INSERT INTO chat_messages (conversation_id, tenant_slug, author_type, author_user_id, body)
     VALUES ($1, $2, 'citizen', NULL, 'Bom dia!'),
            ($1, $2, 'staff', $3, 'Bom dia, em que posso ajudar?'),
            ($1, $2, 'note', $3, 'Já verifiquei o pedido dela.')`,
    [id, TENANT, userId],
  );

  const before = await client.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM chat_messages WHERE conversation_id = $1",
    [id],
  );
  assert.equal(before.rows[0].count, "3");

  await client.query("DELETE FROM chat_conversations WHERE id = $1", [id]);

  const after = await client.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM chat_messages WHERE conversation_id = $1",
    [id],
  );
  assert.equal(after.rows[0].count, "0");
});

test("a note is its own author type, distinct from staff", async () => {
  const id = await insertConversation({
    status: "active",
    assignedUserId: userId,
  });
  await client.query(
    `INSERT INTO chat_messages (conversation_id, tenant_slug, author_type, author_user_id, body)
     VALUES ($1, $2, 'note', $3, 'Nota interna de teste.')`,
    [id, TENANT, userId],
  );
  const { rows } = await client.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM chat_messages
     WHERE conversation_id = $1 AND author_type = 'note'`,
    [id],
  );
  assert.equal(rows[0].count, "1");
});

test("deleting the assigned attendant leaves the conversation, orphaned", async () => {
  const soloUser = await insertUser();
  const id = await insertConversation({
    status: "active",
    assignedUserId: soloUser,
  });

  await client.query('DELETE FROM "user" WHERE id = $1', [soloUser]);

  const { rows } = await client.query<{
    assigned_user_id: string | null;
  }>("SELECT assigned_user_id FROM chat_conversations WHERE id = $1", [id]);
  assert.equal(rows[0].assigned_user_id, null);
});

test("full flow: waiting, assigned, transferred, closed and linked", async () => {
  const firstAttendant = await insertUser();
  const secondAttendant = await insertUser();
  const request = await insertServiceRequest();

  // Starts waiting, nobody assigned.
  const id = await insertConversation();

  // Assigned: "Atender".
  await client.query(
    `UPDATE chat_conversations
     SET status = 'active', assigned_user_id = $2, assigned_sector = 'RCPN'
     WHERE id = $1`,
    [id, firstAttendant],
  );

  // Transferred: reassigned, plus the system message the citizen reads and
  // the note message that stays internal.
  await client.query(
    `UPDATE chat_conversations
     SET assigned_user_id = $2, assigned_sector = 'PROTESTO'
     WHERE id = $1`,
    [id, secondAttendant],
  );
  await client.query(
    `INSERT INTO chat_messages (conversation_id, tenant_slug, author_type, author_user_id, body)
     VALUES ($1, $2, 'system', NULL, 'Você foi transferido para outro atendente, do Protesto.'),
            ($1, $2, 'note', $3, 'Assunto é de outro setor.')`,
    [id, TENANT, firstAttendant],
  );

  // Closed, linked to the service request.
  await client.query(
    `UPDATE chat_conversations
     SET status = 'closed', closed_at = now(), closed_reason = 'staff', linked_request_id = $2
     WHERE id = $1`,
    [id, request],
  );

  const { rows } = await client.query<{
    status: string;
    assigned_user_id: string;
    assigned_sector: string;
    closed_reason: string;
    linked_request_id: string;
  }>(
    `SELECT status, assigned_user_id, assigned_sector, closed_reason, linked_request_id
     FROM chat_conversations WHERE id = $1`,
    [id],
  );
  assert.equal(rows[0].status, "closed");
  assert.equal(rows[0].assigned_user_id, secondAttendant);
  assert.equal(rows[0].assigned_sector, "PROTESTO");
  assert.equal(rows[0].closed_reason, "staff");
  assert.equal(rows[0].linked_request_id, request);

  const { rows: systemRows } = await client.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM chat_messages
     WHERE conversation_id = $1 AND author_type = 'system'`,
    [id],
  );
  assert.equal(systemRows[0].count, "1");
});

test("deleting the linked service request leaves the transcript, unlinked", async () => {
  const request = await insertServiceRequest();
  const id = await insertConversation({ status: "closed" });
  await client.query(
    "UPDATE chat_conversations SET linked_request_id = $2 WHERE id = $1",
    [id, request],
  );

  await client.query("DELETE FROM service_requests WHERE id = $1", [request]);

  const { rows } = await client.query<{ linked_request_id: string | null }>(
    "SELECT linked_request_id FROM chat_conversations WHERE id = $1",
    [id],
  );
  assert.equal(rows[0].linked_request_id, null);
});

test("the queue index covers tenant and status", async () => {
  const { rows } = await client.query<{ indexname: string }>(
    "SELECT indexname FROM pg_indexes WHERE tablename = 'chat_conversations'",
  );
  const names = rows.map((r) => r.indexname);
  assert.ok(names.includes("chat_conversations_tenant_status"));
  assert.ok(names.includes("chat_conversations_tenant_waiting_since"));
});

test("the polling index covers conversation and created_at", async () => {
  const { rows } = await client.query<{ indexname: string }>(
    "SELECT indexname FROM pg_indexes WHERE tablename = 'chat_messages'",
  );
  assert.ok(
    rows
      .map((r) => r.indexname)
      .includes("chat_messages_conversation_created_at"),
  );
});
