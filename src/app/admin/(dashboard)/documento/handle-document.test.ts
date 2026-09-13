import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { eq } from "drizzle-orm";
import { getAct } from "@/core/acts/catalog.ts";
import { hashAccessKey } from "@/core/request/access-key.ts";
import { SIGNED_FORM_NAMES } from "@/core/request/attachment.ts";
import { TENANTS } from "@/core/tenant/resolve.ts";
import type { Database } from "@/db/index.ts";
import { auditLog } from "@/db/schema.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  attachToRequestWith,
  createServiceRequestWith,
} from "@/lib/service-request.ts";
import {
  handleDocumentWith,
  signedDocumentPrintAction,
} from "./handle-document.ts";

// Migrated from e2e/admin-service-requests.spec.ts, "a via assinada, quando
// existe...": opening a signed copy from the panel leaves the same audit
// trail as printing a fresh one; opening any other attachment leaves none.

const TENANT = TENANTS["cartorio-marinho"];
const ACT = getAct("rcpn-certidao");
if (!ACT) throw new Error("fixture: rcpn-certidao precisa existir");

let db: Database;
let close: () => Promise<void>;
let dir: string;

before(async () => {
  ({ db, close } = await createTestDb());
  dir = mkdtempSync(join(tmpdir(), "veridia-documento-"));
});

after(async () => {
  await close();
  rmSync(dir, { recursive: true, force: true });
});

test("signedDocumentPrintAction names the right audit action, or none", () => {
  assert.equal(
    signedDocumentPrintAction({
      kind: "signed-form",
      displayName: SIGNED_FORM_NAMES.requerimento,
    }),
    "service-request.print.requerimento-assinado",
  );
  assert.equal(
    signedDocumentPrintAction({
      kind: "signed-form",
      displayName: SIGNED_FORM_NAMES.declaracao,
    }),
    "service-request.print.declaracao-assinada",
  );
  assert.equal(
    signedDocumentPrintAction({
      kind: "payment-receipt",
      displayName: "comprovante.pdf",
    }),
    null,
  );
});

test("opening the signed requerimento writes to the audit log", async () => {
  const { id } = await createServiceRequestWith(db, TENANT, ACT, {
    applicantName: "Rosa Almeida Fontes",
    contact: "rosa@exemplo.com",
    accessKeyHash: hashAccessKey("chave-via-assinada"),
  });
  const path = join(dir, "assinado.pdf");
  writeFileSync(path, "%PDF-1.4\n%assinado\n");
  const [attachment] = await attachToRequestWith(
    db,
    TENANT.slug,
    id,
    [
      {
        storedName: "assinado.pdf",
        displayName: SIGNED_FORM_NAMES.requerimento,
        path,
        mimeType: "application/pdf",
        sizeBytes: 20,
      },
    ],
    "signed-form",
  );

  const response = await handleDocumentWith(
    db,
    TENANT,
    "staff-1",
    id,
    attachment.id,
  );
  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get("Content-Disposition"),
    `inline; filename="${SIGNED_FORM_NAMES.requerimento}.pdf"`,
  );

  const entries = await db
    .select()
    .from(auditLog)
    .where(eq(auditLog.action, "service-request.print.requerimento-assinado"));
  assert.equal(entries.filter((e) => e.targetId === id).length, 1);
});

test("opening a payment receipt attachment writes no audit entry", async () => {
  const { id } = await createServiceRequestWith(db, TENANT, ACT, {
    applicantName: "Carlos",
    contact: "carlos@exemplo.com",
    accessKeyHash: hashAccessKey("chave-comprovante"),
  });
  const path = join(dir, "comprovante.pdf");
  writeFileSync(path, "%PDF-1.4\n%comprovante\n");
  const [attachment] = await attachToRequestWith(
    db,
    TENANT.slug,
    id,
    [
      {
        storedName: "comprovante.pdf",
        displayName: "Comprovante de pagamento",
        path,
        mimeType: "application/pdf",
        sizeBytes: 20,
      },
    ],
    "payment-receipt",
  );

  const response = await handleDocumentWith(
    db,
    TENANT,
    "staff-1",
    id,
    attachment.id,
  );
  assert.equal(response.status, 200);

  const entries = await db
    .select()
    .from(auditLog)
    .where(eq(auditLog.targetId, id));
  assert.equal(
    entries.some((e) => e.action.startsWith("service-request.print.")),
    false,
  );
});
