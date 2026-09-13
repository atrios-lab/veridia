import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { eq } from "drizzle-orm";
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
import { printReceiptWith, printRequerimentoWith } from "./handle-print.ts";

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
