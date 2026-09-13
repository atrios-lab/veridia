import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { type Act, getAct } from "@/core/acts/catalog.ts";
import { generateAccessKey, hashAccessKey } from "@/core/request/access-key.ts";
import { verifyPdfLink } from "@/core/request/pdf-link.ts";
import { TENANTS } from "@/core/tenant/resolve.ts";
import type { Database } from "@/db/index.ts";
import { createTestDb } from "@/db/test-db.ts";
import { pdfLinkKey } from "@/lib/pdf-link-key.ts";
import { createServiceRequestWith } from "@/lib/service-request.ts";
import { handleRequerimentoDownloadWith } from "./handle-download.ts";

// Migrated from e2e/service-request.spec.ts ("the signed form is downloadable
// only with the key", "downloading the PDFs..."): what this proves is server
// security (the access key never leaves in a redirect, a wrong key or a
// missing protocol answer the same 404), not navigation, so it stays covered
// rather than dropped. See design.md, decision 8.

const TENANT = TENANTS["cartorio-marinho"];

function requiredAct(id: string): Act {
  const act = getAct(id);
  if (!act) throw new Error(`fixture: ${id} precisa existir no catalogo`);
  return act;
}

const ACT = requiredAct("rcpn-habilitacao-casamento");
const ORIGIN = "https://marinho.exemplo.com";

let db: Database;
let close: () => Promise<void>;

before(async () => {
  ({ db, close } = await createTestDb());
});

after(async () => {
  await close();
});

async function fileRequest(accessKey: string) {
  return createServiceRequestWith(db, TENANT, ACT, {
    applicantName: "Maria José da Silva",
    contact: `maria.${globalThis.crypto.randomUUID()}@exemplo.com`,
    accessKeyHash: hashAccessKey(accessKey),
  });
}

function formOf(fields: Record<string, string>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return form;
}

test("a wrong key and a missing protocol both answer 404, the same way", async () => {
  const accessKey = generateAccessKey();
  const { protocolNumber } = await fileRequest(accessKey);

  const wrongKey = await handleRequerimentoDownloadWith(
    db,
    TENANT,
    formOf({ protocolNumber, accessKey: "AAAA-BBBB-CCCC" }),
    ORIGIN,
  );
  assert.equal(wrongKey.status, 404);

  const missingProtocol = await handleRequerimentoDownloadWith(
    db,
    TENANT,
    formOf({ protocolNumber: "REQ.2026.999999", accessKey }),
    ORIGIN,
  );
  assert.equal(missingProtocol.status, 404);
});

test("the redirect to the signed link never carries the access key", async () => {
  const accessKey = generateAccessKey();
  const { protocolNumber } = await fileRequest(accessKey);

  const response = await handleRequerimentoDownloadWith(
    db,
    TENANT,
    formOf({ protocolNumber, accessKey }),
    ORIGIN,
  );

  assert.equal(response.status, 303);
  const location = response.headers.get("Location") ?? "";
  assert.ok(!location.includes(accessKey));
  assert.ok(!location.includes(accessKey.replace(/-/g, "")));
  // Relative, never an absolute URL to another origin: a redirect that
  // changes origin is one the page's own CSP tells the browser to abort.
  assert.ok(location.startsWith("/solicitar/requerimento/"));

  const token = new URL(location, ORIGIN).searchParams.get("t") ?? "";
  const link = verifyPdfLink(token, pdfLinkKey, Math.floor(Date.now() / 1000));
  assert.ok(link);
  assert.equal(link.tenantSlug, TENANT.slug);
  assert.equal(link.protocolNumber, protocolNumber);
  assert.equal(link.documento, "requerimento");
});

test("the access receipt is answered straight from the POST, printing the key", async () => {
  const accessKey = generateAccessKey();
  const { protocolNumber } = await fileRequest(accessKey);

  const response = await handleRequerimentoDownloadWith(
    db,
    TENANT,
    formOf({ protocolNumber, accessKey, documento: "comprovante" }),
    ORIGIN,
  );

  assert.equal(response.status, 200);
  assert.match(response.headers.get("Content-Type") ?? "", /application\/pdf/);
  assert.equal(
    response.headers.get("Content-Disposition"),
    `attachment; filename="comprovante-${protocolNumber}.pdf"`,
  );
  const body = Buffer.from(await response.arrayBuffer());
  assert.equal(body.subarray(0, 5).toString(), "%PDF-");
});

test("a wrong access key never opens the access receipt either", async () => {
  const accessKey = generateAccessKey();
  const { protocolNumber } = await fileRequest(accessKey);

  const response = await handleRequerimentoDownloadWith(
    db,
    TENANT,
    formOf({
      protocolNumber,
      accessKey: "AAAA-BBBB-CCCC",
      documento: "comprovante",
    }),
    ORIGIN,
  );
  assert.equal(response.status, 404);
});
