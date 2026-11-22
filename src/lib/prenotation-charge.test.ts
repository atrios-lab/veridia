import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { and, eq } from "drizzle-orm";
import { getAct } from "@/core/acts/catalog.ts";
import type { FeeItem } from "@/core/fees/prenotation.ts";
import { hashAccessKey } from "@/core/request/access-key.ts";
import { readPrenotation } from "@/core/request/kinds.ts";
import { TENANTS } from "@/core/tenant/resolve.ts";
import type { Database } from "@/db/index.ts";
import { auditLog } from "@/db/schema.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  chargeAtCounterWith,
  confirmPrenotationPaymentWith,
  getPrenotationChargeSettingWith,
  PrenotationError,
  type PrenotationPrice,
  releaseRequestWith,
  repricePendingPrenotationsWith,
  setPrenotationChargeSettingWith,
} from "./prenotation-charge.ts";
import { createServiceRequestWith, findByIdWith } from "./service-request.ts";

const TENANT = TENANTS["cartorio-marinho"];
const FOUND = getAct("ri-prenotacao");
if (!FOUND) throw new Error("fixture: ri-prenotacao precisa existir");
const ACT = FOUND;

let db: Database;
let close: () => Promise<void>;
before(async () => {
  ({ db, close } = await createTestDb());
});
after(async () => {
  await close();
});

/** A fictitious table: the prenotação of Imóveis at `cents`. */
function tableAt(
  cents: number,
  title = "Tabela fictícia 2026",
): PrenotationPrice {
  const item: FeeItem = {
    code: "2600103",
    description: "Prenotação",
    totalCents: cents,
  };
  return async (attribution) =>
    attribution === "RI"
      ? { item, tableTitle: title, documentId: "tabela-ficticia" }
      : undefined;
}

async function filed(name: string, status?: "awaiting-signed-form") {
  return createServiceRequestWith(db, TENANT, ACT, {
    applicantName: name,
    contact: `${name.toLowerCase()}@exemplo.com`,
    accessKeyHash: hashAccessKey(`chave-${name}`),
    ...(status ? { status } : {}),
  });
}

test("aceito o requerimento, o pedido aguarda o pagamento da prenotação pela tabela vigente", async () => {
  assert.equal(
    (await getPrenotationChargeSettingWith(db, TENANT.slug)).enabled,
    true,
  );
  const { id } = await filed("Ana", "awaiting-signed-form");
  const status = await releaseRequestWith(db, TENANT, id, null, tableAt(5790));
  assert.equal(status, "awaiting-payment");
  const request = await findByIdWith(db, TENANT.slug, id);
  assert.equal(request?.status, "awaiting-payment");
  assert.equal(request?.amountCents, 5790);
  assert.equal(readPrenotation(request?.details)?.code, "2600103");
});

test("confirmado o pagamento, a prenotação fica paga e o pedido vai para a análise", async () => {
  const { id } = await filed("Bruno", "awaiting-signed-form");
  await releaseRequestWith(db, TENANT, id, null, tableAt(5790));
  await confirmPrenotationPaymentWith(db, TENANT, id, "staff-1", "counter");
  const request = await findByIdWith(db, TENANT.slug, id);
  assert.equal(request?.status, "in-review");
  // The value of the act comes after the analysis.
  assert.equal(request?.amountCents, null);
  const charge = readPrenotation(request?.details);
  assert.ok(charge?.paidAt);
  assert.equal(charge?.paidHow, "counter");
  // Twice is refused: nothing left to pay.
  await assert.rejects(
    confirmPrenotationPaymentWith(db, TENANT, id, "staff-1", "counter"),
    PrenotationError,
  );
  const [paid] = await db
    .select({ reason: auditLog.reason })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.targetId, id),
        eq(auditLog.action, "service-request.prenotation-paid"),
      ),
    );
  assert.match(paid?.reason ?? "", /balcão/);
});

test("no balcão, a prenotação é cobrada na hora", async () => {
  const { id } = await filed("Carla");
  const charge = await chargeAtCounterWith(
    db,
    TENANT,
    id,
    "staff-1",
    tableAt(6100),
  );
  assert.equal(charge?.totalCents, 6100);
  const request = await findByIdWith(db, TENANT.slug, id);
  assert.equal(request?.status, "awaiting-payment");
  assert.equal(request?.amountCents, 6100);
});

test("a tabela mudou: quem ainda não pagou passa ao valor novo, com o antigo no histórico", async () => {
  const { id } = await filed("Davi", "awaiting-signed-form");
  await releaseRequestWith(db, TENANT, id, null, tableAt(5790));
  // A comprovante already sent is not repriced under it.
  const reported = await filed("Elisa", "awaiting-signed-form");
  await releaseRequestWith(db, TENANT, reported.id, null, tableAt(5790));
  const { serviceRequests } = await import("@/db/schema.ts");
  await db
    .update(serviceRequests)
    .set({ status: "payment-reported" })
    .where(eq(serviceRequests.id, reported.id));

  const changed = await repricePendingPrenotationsWith(
    db,
    TENANT,
    tableAt(6200, "Tabela fictícia 2027"),
    null,
  );
  assert.ok(changed >= 1);
  const request = await findByIdWith(db, TENANT.slug, id);
  assert.equal(request?.amountCents, 6200);
  const charge = readPrenotation(request?.details);
  assert.equal(charge?.tableTitle, "Tabela fictícia 2027");
  assert.deepEqual(
    charge?.repriced?.map((r) => r.totalCents),
    [5790],
  );
  const untouched = await findByIdWith(db, TENANT.slug, reported.id);
  assert.equal(untouched?.amountCents, 5790);
});

test("desligado pelo Tabelião, o pedido segue como antes, sem cobrar", async () => {
  await setPrenotationChargeSettingWith(db, TENANT.slug, false, "tabeliao");
  const { id } = await filed("Fábio", "awaiting-signed-form");
  assert.equal(
    await releaseRequestWith(db, TENANT, id, null, tableAt(5790)),
    "new",
  );
  const counter = await filed("Gilda");
  assert.equal(
    await chargeAtCounterWith(db, TENANT, counter.id, "staff-1", tableAt(5790)),
    undefined,
  );
  const request = await findByIdWith(db, TENANT.slug, id);
  assert.equal(request?.amountCents, null);
  await setPrenotationChargeSettingWith(db, TENANT.slug, true, "tabeliao");
  assert.equal(
    (await getPrenotationChargeSettingWith(db, TENANT.slug)).enabled,
    true,
  );
});
