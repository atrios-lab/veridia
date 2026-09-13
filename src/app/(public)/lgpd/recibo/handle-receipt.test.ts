import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { hashAccessKey } from "@/core/request/access-key.ts";
import { TENANTS } from "@/core/tenant/resolve.ts";
import type { Database } from "@/db/index.ts";
import { createTestDb } from "@/db/test-db.ts";
import { createRecordWith } from "@/lib/service-request.ts";
import { handleDataRightsReceiptWith } from "./handle-receipt.ts";

// Migrated from e2e/channels.spec.ts, "canal LGPD, gravando": the receipt
// route answers only with a matching protocol and key, and prints a PDF.

const TENANT = TENANTS["cartorio-marinho"];
const ORIGIN = "https://marinho.exemplo.com";

let db: Database;
let close: () => Promise<void>;

before(async () => {
  ({ db, close } = await createTestDb());
});

after(async () => {
  await close();
});

function formOf(fields: Record<string, string>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return form;
}

test("a filed data-rights request gets a PDF receipt with the matching key", async () => {
  const key = "TEST-KEYS-0001";
  const { protocolNumber } = await createRecordWith(db, TENANT, "data-rights", {
    applicantName: "Maria José da Silva",
    contact: "maria@email.com",
    description: "Quero saber quais dados constam do meu cadastro.",
    accessKeyHash: hashAccessKey(key),
    details: { right: "access" },
  });

  const response = await handleDataRightsReceiptWith(
    db,
    TENANT,
    formOf({ protocolNumber, accessKey: key }),
    ORIGIN,
  );

  assert.equal(response.status, 200);
  assert.match(response.headers.get("Content-Type") ?? "", /application\/pdf/);
  assert.equal(
    response.headers.get("Content-Disposition"),
    `attachment; filename="recibo-lgpd-${protocolNumber}.pdf"`,
  );
  const body = Buffer.from(await response.arrayBuffer());
  assert.equal(body.subarray(0, 5).toString(), "%PDF-");
});

test("a wrong key gets the same 404 as a protocol that does not exist", async () => {
  const key = "TEST-KEYS-0002";
  const { protocolNumber } = await createRecordWith(db, TENANT, "data-rights", {
    applicantName: "Rosa Almeida Fontes",
    contact: "rosa@email.com",
    description: "Quero corrigir meu endereço.",
    accessKeyHash: hashAccessKey(key),
    details: { right: "access" },
  });

  const wrongKey = await handleDataRightsReceiptWith(
    db,
    TENANT,
    formOf({ protocolNumber, accessKey: "AAAA-BBBB-CCCC" }),
    ORIGIN,
  );
  assert.equal(wrongKey.status, 404);

  const noProtocol = await handleDataRightsReceiptWith(
    db,
    TENANT,
    formOf({ protocolNumber: "SOL.2098.999999", accessKey: key }),
    ORIGIN,
  );
  assert.equal(noProtocol.status, 404);
});
