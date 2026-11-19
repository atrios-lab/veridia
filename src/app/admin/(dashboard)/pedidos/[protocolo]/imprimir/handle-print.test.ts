import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { eq } from "drizzle-orm";
import { PDFDocument } from "pdf-lib";
import { getAct } from "@/core/acts/catalog.ts";
import { hashAccessKey } from "@/core/request/access-key.ts";
import { paletteFor } from "@/core/tenant/palette.ts";
import { TENANTS } from "@/core/tenant/resolve.ts";
import type { Database } from "@/db/index.ts";
import { auditLog } from "@/db/schema.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  createServiceRequestWith,
  findByProtocolWith,
} from "@/lib/service-request.ts";
import {
  parseCounterSelection,
  printReceiptWith,
  printRequerimentoWith,
  printSelectionWith,
} from "./handle-print.ts";

// Migrated from e2e/admin-service-requests.spec.ts, "printing writes to
// audit_log; a refused key does not": the session/permission gate stays in
// route.ts (Better Auth, not tested in process); what is regra is proven
// here, straight against the handlers.

const TENANT = TENANTS["cartorio-marinho"];
const ACT = getAct("rcpn-certidao");
if (!ACT) throw new Error("fixture: rcpn-certidao precisa existir");
const BRAND = { palette: paletteFor(TENANT.theme) };

let db: Database;
let close: () => Promise<void>;

before(async () => {
  ({ db, close } = await createTestDb());
});

after(async () => {
  await close();
});

async function auditCount(action: string, targetId: string): Promise<number> {
  const rows = await db
    .select()
    .from(auditLog)
    .where(eq(auditLog.action, action));
  return rows.filter((r) => r.targetId === targetId).length;
}

test("printing the requerimento writes one audit entry, under its own action", async () => {
  const key = "TEST-KEYS-2000";
  const { id, protocolNumber } = await createServiceRequestWith(
    db,
    TENANT,
    ACT,
    {
      applicantName: "Rosa Almeida Fontes",
      contact: "rosa@exemplo.com",
      accessKeyHash: hashAccessKey(key),
    },
  );
  const stored = await findByProtocolWith(db, TENANT.slug, protocolNumber);
  if (!stored) throw new Error("fixture: pedido precisa existir");

  assert.equal(await auditCount("service-request.print.requerimento", id), 0);

  const response = await printRequerimentoWith(
    db,
    TENANT,
    stored,
    "staff-1",
    BRAND,
    null,
  );
  assert.equal(response.status, 200);
  assert.equal(await auditCount("service-request.print.requerimento", id), 1);
});

test("a wrong access key writes nothing; the right one writes exactly once", async () => {
  const key = "TEST-KEYS-2001";
  const { id, protocolNumber } = await createServiceRequestWith(
    db,
    TENANT,
    ACT,
    {
      applicantName: "Carlos",
      contact: "carlos@exemplo.com",
      accessKeyHash: hashAccessKey(key),
    },
  );
  const stored = await findByProtocolWith(db, TENANT.slug, protocolNumber);
  if (!stored) throw new Error("fixture: pedido precisa existir");

  const refused = await printReceiptWith(
    db,
    TENANT,
    stored,
    "staff-1",
    BRAND,
    "AAAA-BBBB-CCCC",
  );
  assert.equal(refused.status, 404);
  assert.equal(await auditCount("service-request.print.comprovante", id), 0);

  const granted = await printReceiptWith(
    db,
    TENANT,
    stored,
    "staff-1",
    BRAND,
    key,
  );
  assert.equal(granted.status, 200);
  assert.equal(
    granted.headers.get("Content-Disposition"),
    `attachment; filename="comprovante-${protocolNumber}.pdf"`,
  );
  assert.equal(await auditCount("service-request.print.comprovante", id), 1);
});

test("declaracao only prints for a pedido with gratuidade", async () => {
  const key = "TEST-KEYS-2002";
  const { protocolNumber } = await createServiceRequestWith(db, TENANT, ACT, {
    applicantName: "Sem Gratuidade",
    contact: "sem-gratuidade@exemplo.com",
    accessKeyHash: hashAccessKey(key),
  });
  const stored = await findByProtocolWith(db, TENANT.slug, protocolNumber);
  if (!stored) throw new Error("fixture: pedido precisa existir");

  const response = await printRequerimentoWith(
    db,
    TENANT,
    stored,
    "staff-1",
    BRAND,
    "declaracao",
  );
  assert.equal(response.status, 404);
});

test("a pedido with gratuidade prints its declaracao and audits under its own action", async () => {
  const key = "TEST-KEYS-2003";
  const { id, protocolNumber } = await createServiceRequestWith(
    db,
    TENANT,
    ACT,
    {
      applicantName: "Com Gratuidade",
      contact: "com-gratuidade@exemplo.com",
      accessKeyHash: hashAccessKey(key),
      details: { exemption: { declaredAt: new Date().toISOString() } },
    },
  );
  const stored = await findByProtocolWith(db, TENANT.slug, protocolNumber);
  if (!stored) throw new Error("fixture: pedido precisa existir");

  assert.equal(await auditCount("service-request.print.declaracao", id), 0);
  const response = await printRequerimentoWith(
    db,
    TENANT,
    stored,
    "staff-1",
    BRAND,
    "declaracao",
  );
  assert.equal(response.status, 200);
  assert.equal(await auditCount("service-request.print.declaracao", id), 1);
});

async function pageCount(response: Response): Promise<number> {
  const bytes = new Uint8Array(await response.arrayBuffer());
  return (await PDFDocument.load(bytes)).getPageCount();
}

test("the counter's selection keeps known documents, once, in printing order", () => {
  assert.deepEqual(
    parseCounterSelection([
      "comprovante",
      "requerimento",
      "comprovante",
      "outro",
      "declaracao",
    ]),
    ["requerimento", "declaracao", "comprovante"],
  );
  assert.deepEqual(parseCounterSelection([]), []);
});

test("emitting both puts requerimento and comprovante in one PDF and audits each", async () => {
  const key = "TEST-KEYS-2004";
  const { id, protocolNumber } = await createServiceRequestWith(
    db,
    TENANT,
    ACT,
    {
      applicantName: "Lia Exemplo Prado",
      contact: "lia@exemplo.com",
      accessKeyHash: hashAccessKey(key),
    },
  );
  const stored = await findByProtocolWith(db, TENANT.slug, protocolNumber);
  if (!stored) throw new Error("fixture: pedido precisa existir");

  const alone = await printRequerimentoWith(
    db,
    TENANT,
    stored,
    "staff-1",
    BRAND,
    null,
  );
  const requerimentoPages = await pageCount(alone);
  const receipt = await printReceiptWith(
    db,
    TENANT,
    stored,
    "staff-1",
    BRAND,
    key,
  );
  const receiptPages = await pageCount(receipt);

  const both = await printSelectionWith(db, TENANT, stored, "staff-1", BRAND, {
    documents: ["requerimento", "comprovante"],
    accessKey: key,
    mode: "imprimir",
  });
  assert.equal(both.status, 200);
  assert.equal(
    both.headers.get("Content-Disposition"),
    `inline; filename="documentos-${protocolNumber}.pdf"`,
  );
  assert.equal(await pageCount(both), requerimentoPages + receiptPages);
  // One entry each from the single prints above, one more each from this.
  assert.equal(await auditCount("service-request.print.requerimento", id), 2);
  assert.equal(await auditCount("service-request.print.comprovante", id), 2);
});

test("emitting one document to save comes as a download under its own name", async () => {
  const key = "TEST-KEYS-2005";
  const { id, protocolNumber } = await createServiceRequestWith(
    db,
    TENANT,
    ACT,
    {
      applicantName: "Davi Teste Moura",
      contact: "davi@exemplo.com",
      accessKeyHash: hashAccessKey(key),
    },
  );
  const stored = await findByProtocolWith(db, TENANT.slug, protocolNumber);
  if (!stored) throw new Error("fixture: pedido precisa existir");

  const response = await printSelectionWith(
    db,
    TENANT,
    stored,
    "staff-1",
    BRAND,
    { documents: ["requerimento"], accessKey: "", mode: "baixar" },
  );
  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get("Content-Disposition"),
    `attachment; filename="requerimento-${protocolNumber}.pdf"`,
  );
  assert.equal(await auditCount("service-request.print.requerimento", id), 1);
  assert.equal(await auditCount("service-request.print.comprovante", id), 0);
});

test("a wrong key or a declaração the pedido lacks refuses the whole selection and audits nothing", async () => {
  const key = "TEST-KEYS-2006";
  const { id, protocolNumber } = await createServiceRequestWith(
    db,
    TENANT,
    ACT,
    {
      applicantName: "Nina Amostra Reis",
      contact: "nina@exemplo.com",
      accessKeyHash: hashAccessKey(key),
    },
  );
  const stored = await findByProtocolWith(db, TENANT.slug, protocolNumber);
  if (!stored) throw new Error("fixture: pedido precisa existir");

  const wrongKey = await printSelectionWith(
    db,
    TENANT,
    stored,
    "staff-1",
    BRAND,
    {
      documents: ["requerimento", "comprovante"],
      accessKey: "AAAA-BBBB-CCCC",
      mode: "imprimir",
    },
  );
  assert.equal(wrongKey.status, 404);

  const noDeclaracao = await printSelectionWith(
    db,
    TENANT,
    stored,
    "staff-1",
    BRAND,
    {
      documents: ["requerimento", "declaracao"],
      accessKey: key,
      mode: "imprimir",
    },
  );
  assert.equal(noDeclaracao.status, 404);

  const nothing = await printSelectionWith(
    db,
    TENANT,
    stored,
    "staff-1",
    BRAND,
    { documents: [], accessKey: key, mode: "imprimir" },
  );
  assert.equal(nothing.status, 400);

  assert.equal(await auditCount("service-request.print.requerimento", id), 0);
  assert.equal(await auditCount("service-request.print.comprovante", id), 0);
});

test("with gratuidade, the three come out together with the declaração in the middle", async () => {
  const key = "TEST-KEYS-2007";
  const { id, protocolNumber } = await createServiceRequestWith(
    db,
    TENANT,
    ACT,
    {
      applicantName: "Caio Modelo Neves",
      contact: "caio@exemplo.com",
      accessKeyHash: hashAccessKey(key),
      details: { exemption: { declaredAt: new Date().toISOString() } },
    },
  );
  const stored = await findByProtocolWith(db, TENANT.slug, protocolNumber);
  if (!stored) throw new Error("fixture: pedido precisa existir");

  const response = await printSelectionWith(
    db,
    TENANT,
    stored,
    "staff-1",
    BRAND,
    {
      documents: parseCounterSelection([
        "comprovante",
        "declaracao",
        "requerimento",
      ]),
      accessKey: key,
      mode: "baixar",
    },
  );
  assert.equal(response.status, 200);
  assert.ok((await pageCount(response)) >= 3);
  assert.equal(await auditCount("service-request.print.requerimento", id), 1);
  assert.equal(await auditCount("service-request.print.declaracao", id), 1);
  assert.equal(await auditCount("service-request.print.comprovante", id), 1);
});
