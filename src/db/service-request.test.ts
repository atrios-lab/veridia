import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

// The protocol counter, against Postgres in process. The application reads the
// last sequence and then writes the next one, which two citizens can do at the
// same instant; what makes that safe is the unique index asserted here. If it
// ever stops being unique, two people walk away with the same protocol number
// and the office cannot tell their requests apart.

const MIGRATIONS_DIR = "drizzle";
const UNIQUE_VIOLATION = "23505";

let client: PGlite;

async function fileRequest(
  tenantSlug: string,
  year: number,
  sequence: number,
): Promise<void> {
  const protocolNumber = `REQ.${year}.${String(sequence).padStart(6, "0")}`;
  await client.query(
    `INSERT INTO service_requests
       (tenant_slug, protocol_year, protocol_sequence, protocol_number,
        act_id, attribution, applicant_name, contact, access_key_hash)
     VALUES ($1, $2, $3, $4, 'rcpn-certidao', 'RCPN', 'Maria', 'maria@exemplo.com', 'hash')`,
    [tenantSlug, year, sequence, protocolNumber],
  );
}

/** A record of any of the four kinds, with only what that kind requires. */
async function fileRecord(
  kind: string,
  prefix: string,
  tenantSlug: string,
  year: number,
  sequence: number,
): Promise<void> {
  const protocolNumber = `${prefix}.${year}.${String(sequence).padStart(6, "0")}`;
  await client.query(
    `INSERT INTO service_requests
       (tenant_slug, kind, protocol_year, protocol_sequence, protocol_number,
        applicant_name, contact, access_key_hash)
     VALUES ($1, $2, $3, $4, $5, 'Maria', 'maria@exemplo.com', 'hash')`,
    [tenantSlug, kind, year, sequence, protocolNumber],
  );
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

test("the counter belongs to one office and one year", async () => {
  await fileRequest("cartorio-marinho", 2026, 1);
  // Another office reaching the same number is not a conflict: each office
  // has its own book.
  await fileRequest("tabelionato-aurora", 2026, 1);
  // Neither is the same number in the next year: the sequence restarts.
  await fileRequest("cartorio-marinho", 2027, 1);

  const { rows } = await client.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM service_requests",
  );
  assert.equal(rows[0].count, "3");
});

test("the same number twice in one office and year is refused", async () => {
  await assert.rejects(
    () => fileRequest("cartorio-marinho", 2026, 1),
    (error: { code?: string }) => error.code === UNIQUE_VIOLATION,
  );
});

test("each kind has its own counter in the same office and year", async () => {
  // AGD.2026.000001 and SOL.2026.000001 are different books, so the same
  // sequence in the same year is not a conflict between kinds.
  await fileRecord("appointment", "AGD", "cartorio-marinho", 2026, 1);
  await fileRecord("data-rights", "SOL", "cartorio-marinho", 2026, 1);
  await fileRecord("ombudsman", "OUV", "cartorio-marinho", 2026, 1);

  await assert.rejects(
    () => fileRecord("appointment", "AGD", "cartorio-marinho", 2026, 1),
    (error: { code?: string }) => error.code === UNIQUE_VIOLATION,
  );
});

test("an anonymous manifestation is filed without name, contact or key", async () => {
  // Nobody signed it: there is nothing to protect with a key and nobody to
  // answer. The columns accept that; what each kind requires is the core's
  // job, which is where the rule can be read.
  await client.query(
    `INSERT INTO service_requests
       (tenant_slug, kind, protocol_year, protocol_sequence, protocol_number, details)
     VALUES ('cartorio-marinho', 'ombudsman', 2026, 2, 'OUV.2026.000002',
             '{"manifestationType":"complaint","anonymous":true,"confidential":false}')`,
  );
  const { rows } = await client.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM service_requests
     WHERE protocol_number = 'OUV.2026.000002'
       AND applicant_name IS NULL AND contact IS NULL AND access_key_hash IS NULL`,
  );
  assert.equal(rows[0].count, "1");
});

test("rows filed before the other channels existed are service requests", async () => {
  const { rows } = await client.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM service_requests WHERE kind = 'service-request'",
  );
  // The three REQ rows from the first test, classified by the column default.
  assert.equal(rows[0].count, "3");
});

test("attachments follow the request when it is deleted", async () => {
  const { rows } = await client.query<{ id: string }>(
    "SELECT id FROM service_requests WHERE tenant_slug = $1 AND protocol_year = 2027",
    ["cartorio-marinho"],
  );
  const requestId = rows[0].id;
  await client.query(
    `INSERT INTO service_request_attachments
       (tenant_slug, request_id, kind, stored_name, display_name, path, mime_type, size_bytes)
     VALUES ('cartorio-marinho', $1, 'citizen', 'a.pdf', 'anexo-1', '/tmp/a.pdf', 'application/pdf', 10)`,
    [requestId],
  );

  await client.query("DELETE FROM service_requests WHERE id = $1", [requestId]);
  const left = await client.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM service_request_attachments",
  );
  assert.equal(left.rows[0].count, "0");
});

test("a request is filed with no amount, and the office can set one", async () => {
  await fileRequest("cartorio-marinho", 2028, 1);
  const before = await client.query<{ amount_cents: number | null }>(
    "SELECT amount_cents FROM service_requests WHERE protocol_number = 'REQ.2028.000001'",
  );
  assert.equal(before.rows[0].amount_cents, null);

  await client.query(
    "UPDATE service_requests SET amount_cents = $1 WHERE protocol_number = 'REQ.2028.000001'",
    [6210],
  );
  const after = await client.query<{ amount_cents: number }>(
    "SELECT amount_cents FROM service_requests WHERE protocol_number = 'REQ.2028.000001'",
  );
  assert.equal(after.rows[0].amount_cents, 6210);
});

test("a requirement is removed with the request it belongs to", async () => {
  const { rows } = await client.query<{ id: string }>(
    "SELECT id FROM service_requests WHERE protocol_number = 'REQ.2028.000001'",
  );
  const requestId = rows[0].id;
  await client.query(
    `INSERT INTO service_request_requirements (tenant_slug, request_id, text)
     VALUES ('cartorio-marinho', $1, 'Falta cópia legível do documento de identidade.')`,
    [requestId],
  );

  await client.query("DELETE FROM service_requests WHERE id = $1", [requestId]);
  const left = await client.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM service_request_requirements",
  );
  assert.equal(left.rows[0].count, "0");
});

test("a requirement is fulfilled by linking its resolving attachment", async () => {
  await fileRequest("cartorio-marinho", 2028, 2);
  const { rows: requestRows } = await client.query<{ id: string }>(
    "SELECT id FROM service_requests WHERE protocol_number = 'REQ.2028.000002'",
  );
  const requestId = requestRows[0].id;

  const { rows: requirementRows } = await client.query<{ id: string }>(
    `INSERT INTO service_request_requirements (tenant_slug, request_id, text)
     VALUES ('cartorio-marinho', $1, 'Requerimento sem assinatura.')
     RETURNING id`,
    [requestId],
  );
  const requirementId = requirementRows[0].id;

  const { rows: attachmentRows } = await client.query<{ id: string }>(
    `INSERT INTO service_request_attachments
       (tenant_slug, request_id, kind, stored_name, display_name, path, mime_type, size_bytes)
     VALUES ('cartorio-marinho', $1, 'citizen', 'b.pdf', 'anexo-1', '/tmp/b.pdf', 'application/pdf', 10)
     RETURNING id`,
    [requestId],
  );
  const attachmentId = attachmentRows[0].id;

  await client.query(
    `UPDATE service_request_requirements
     SET status = 'fulfilled', fulfilled_at = now(), resolution_attachment_id = $1
     WHERE id = $2`,
    [attachmentId, requirementId],
  );

  const { rows } = await client.query<{
    status: string;
    resolution_attachment_id: string;
  }>(
    "SELECT status, resolution_attachment_id FROM service_request_requirements WHERE id = $1",
    [requirementId],
  );
  assert.equal(rows[0].status, "fulfilled");
  assert.equal(rows[0].resolution_attachment_id, attachmentId);
});

test("a channel's queue only ever sees its own kind", async () => {
  // Two ombudsman rows exist by now (one from "each kind has its own
  // counter", one from "an anonymous manifestation is filed...") alongside
  // several REQ, AGD and SOL rows sharing this table; a query scoped to one
  // kind must not leak another's rows into its count.
  const { rows } = await client.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM service_requests WHERE tenant_slug = $1 AND kind = 'ombudsman'",
    ["cartorio-marinho"],
  );
  assert.equal(rows[0].count, "2");
});

test("responding to a data-rights request writes the reply and clears the draft", async () => {
  await fileRecord("data-rights", "SOL", "cartorio-marinho", 2028, 1);
  await client.query(
    `UPDATE service_requests
     SET details = '{"right":"access","draftReply":"rascunho"}'
     WHERE protocol_number = 'SOL.2028.000001'`,
  );

  // What `respondToRecord` does: write the reply, stamp the time, move the
  // status, and drop `draftReply` from `details` in the same write.
  await client.query(
    `UPDATE service_requests
     SET office_reply = $1, office_replied_at = now(), status = 'answered',
         details = details - 'draftReply'
     WHERE protocol_number = 'SOL.2028.000001'`,
    ["Segue a resposta ao titular."],
  );

  const { rows } = await client.query<{
    office_reply: string;
    status: string;
    details: { right: string; draftReply?: string };
  }>(
    "SELECT office_reply, status, details FROM service_requests WHERE protocol_number = 'SOL.2028.000001'",
  );
  assert.equal(rows[0].office_reply, "Segue a resposta ao titular.");
  assert.equal(rows[0].status, "answered");
  assert.equal(rows[0].details.right, "access");
  assert.equal(rows[0].details.draftReply, undefined);
});

test("reissuing the access key leaves only the new hash valid", async () => {
  await fileRequest("cartorio-marinho", 2028, 3);
  await client.query(
    "UPDATE service_requests SET access_key_hash = 'new-hash' WHERE protocol_number = 'REQ.2028.000003'",
  );
  const { rows } = await client.query<{ access_key_hash: string }>(
    "SELECT access_key_hash FROM service_requests WHERE protocol_number = 'REQ.2028.000003'",
  );
  // The old hash ('hash', from fileRequest) is simply gone: there is no
  // second column or revocation list to check against.
  assert.equal(rows[0].access_key_hash, "new-hash");
  assert.notEqual(rows[0].access_key_hash, "hash");
});
