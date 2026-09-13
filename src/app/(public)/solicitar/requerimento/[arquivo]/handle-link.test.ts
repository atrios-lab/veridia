import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { type Act, getAct } from "@/core/acts/catalog.ts";
import { hashAccessKey } from "@/core/request/access-key.ts";
import { PDF_LINK_TTL_SECONDS, signPdfLink } from "@/core/request/pdf-link.ts";
import { TENANTS } from "@/core/tenant/resolve.ts";
import type { Database } from "@/db/index.ts";
import { createTestDb } from "@/db/test-db.ts";
import { pdfLinkKey } from "@/lib/pdf-link-key.ts";
import { createServiceRequestWith } from "@/lib/service-request.ts";
import { handleRequerimentoLinkWith } from "./handle-link.ts";

// Migrated from e2e/service-request.spec.ts: proves the signed GET link
// (what the POST next door redirects to) refuses a forged, expired or
// cross-tenant token before it ever touches the database, and serves the
// right document inline when the token is good. See design.md, decision 8.

const TENANT = TENANTS["cartorio-marinho"];
const OTHER_TENANT = TENANTS["tabelionato-aurora"];

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

async function fileRequest() {
  return createServiceRequestWith(db, TENANT, ACT, {
    applicantName: "Maria José da Silva",
    contact: `maria.${globalThis.crypto.randomUUID()}@exemplo.com`,
    accessKeyHash: hashAccessKey("chave-de-teste"),
  });
}

function requestFor(token: string): Request {
  return new Request(
    `${ORIGIN}/solicitar/requerimento/requerimento.pdf?t=${encodeURIComponent(token)}`,
  );
}

test("a good token serves the requerimento inline, under its own file name", async () => {
  const { protocolNumber } = await fileRequest();
  const token = signPdfLink(
    {
      tenantSlug: TENANT.slug,
      protocolNumber,
      documento: "requerimento",
      expiresAt: Math.floor(Date.now() / 1000) + PDF_LINK_TTL_SECONDS,
    },
    pdfLinkKey,
  );

  const response = await handleRequerimentoLinkWith(
    db,
    TENANT,
    requestFor(token),
  );

  assert.equal(response.status, 200);
  assert.match(response.headers.get("Content-Type") ?? "", /application\/pdf/);
  assert.equal(
    response.headers.get("Content-Disposition"),
    `inline; filename="requerimento-${protocolNumber}.pdf"`,
  );
});

test("a token minted for another tenant is refused, whatever it names", async () => {
  const { protocolNumber } = await fileRequest();
  const token = signPdfLink(
    {
      tenantSlug: OTHER_TENANT.slug,
      protocolNumber,
      documento: "requerimento",
      expiresAt: Math.floor(Date.now() / 1000) + PDF_LINK_TTL_SECONDS,
    },
    pdfLinkKey,
  );

  const response = await handleRequerimentoLinkWith(
    db,
    TENANT,
    requestFor(token),
  );
  assert.equal(response.status, 404);
});

test("an expired token is refused, same as one that was never valid", async () => {
  const { protocolNumber } = await fileRequest();
  const expired = signPdfLink(
    {
      tenantSlug: TENANT.slug,
      protocolNumber,
      documento: "requerimento",
      expiresAt: Math.floor(Date.now() / 1000) - 1,
    },
    pdfLinkKey,
  );
  const forged = "not-a-real-token.forged";

  for (const token of [expired, forged]) {
    const response = await handleRequerimentoLinkWith(
      db,
      TENANT,
      requestFor(token),
    );
    assert.equal(response.status, 404);
  }
});
