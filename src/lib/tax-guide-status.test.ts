import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { and, eq } from "drizzle-orm";
import { emptyGuide } from "@/core/guides/schema.ts";
import { defaultGuideSettings } from "@/core/guides/settings.ts";
import {
  guidePaymentOverdue,
  guideStatusInputSchema,
  guideStatusOf,
  guideStatusSummary,
} from "@/core/guides/status.ts";
import { cartorioMarinho } from "@/core/tenant/tenants/marinho.ts";
import type { Database } from "@/db/index.ts";
import { auditLog } from "@/db/schema.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  GuideStatusError,
  getGuideStatusWith,
  listGuideStatusesWith,
  receiptOf,
  setGuideStatusWith,
  withdrawGuideReceiptWith,
  withdrawGuideStatusWith,
} from "./tax-guide-status.ts";
import { issueGuideWith } from "./tax-guides.ts";

const OFFICE = "t-guias-situacao";
let db: Database;
let close: () => Promise<void>;
before(async () => {
  ({ db, close } = await createTestDb());
});
after(async () => {
  await close();
});

const blank = emptyGuide(defaultGuideSettings(cartorioMarinho));
const guide = {
  ...blank,
  parties: blank.parties.map((party, index) => ({
    ...party,
    name: index ? "Maria Exemplo da Silva" : "João Fictício de Souza",
  })),
  property: { ...blank.property, description: "Rua Projetada, 10." },
  declaredValueCents: 2_700_000,
};
const receipt = (name: string) => ({
  storedName: `${name}.pdf`,
  displayName: name,
  path: `/tmp/${name}.pdf`,
  mimeType: "application/pdf",
  sizeBytes: 10,
});

test("a guia nasce aguardando pagamento, passa a paga com comprovante e a concluída", async () => {
  const issued = await issueGuideWith(db, OFFICE, guide, "u1");
  const fresh = await getGuideStatusWith(db, OFFICE, issued.id);
  assert.equal(guideStatusOf(fresh), "aguardando-pagamento");
  assert.equal(guideStatusSummary(fresh), "Aguardando pagamento");

  await setGuideStatusWith(
    db,
    OFFICE,
    issued.id,
    guideStatusInputSchema.parse({
      status: "aguardando-pagamento",
      dueOn: "2026-11-30",
    }),
    "u1",
  );
  const waiting = await getGuideStatusWith(db, OFFICE, issued.id);
  assert.equal(guidePaymentOverdue(waiting, "2026-11-30"), false);
  assert.equal(guidePaymentOverdue(waiting, "2026-12-01"), true);

  await setGuideStatusWith(
    db,
    OFFICE,
    issued.id,
    guideStatusInputSchema.parse({
      status: "paga",
      dueOn: "2026-11-30",
      paidOn: "2026-11-25",
    }),
    "u1",
    receipt("Comprovante de pagamento da guia"),
  );
  const paid = await getGuideStatusWith(db, OFFICE, issued.id);
  assert.equal(guideStatusSummary(paid), "Paga em 25/11/2026, com comprovante");
  assert.equal(guidePaymentOverdue(paid, "2026-12-10"), false);

  // Concluding without a new file keeps the comprovante already attached.
  await setGuideStatusWith(
    db,
    OFFICE,
    issued.id,
    guideStatusInputSchema.parse({
      status: "concluida",
      paidOn: "2026-11-25",
      concludedOn: "2026-11-28",
    }),
    "u1",
  );
  const done = await getGuideStatusWith(db, OFFICE, issued.id);
  assert.equal(guideStatusOf(done), "concluida");
  assert.equal(
    done.current?.receipt?.displayName,
    "Comprovante de pagamento da guia",
  );
  // Every earlier version stays.
  assert.deepEqual(
    done.history.map((h) => h.status),
    ["aguardando-pagamento", "paga"],
  );

  const map = await listGuideStatusesWith(db, OFFICE, [issued.id, "outra"]);
  assert.equal(guideStatusOf(map.get(issued.id) ?? fresh), "concluida");
  assert.equal(map.has("outra"), false);
});

test("tirar o comprovante e voltar para aguardando não apagam nada", async () => {
  const issued = await issueGuideWith(db, OFFICE, guide, "u1");
  await setGuideStatusWith(
    db,
    OFFICE,
    issued.id,
    guideStatusInputSchema.parse({ status: "paga", paidOn: "2026-11-20" }),
    "u1",
    receipt("comprovante-errado"),
  );
  await withdrawGuideReceiptWith(db, OFFICE, issued.id, "u1");
  let record = await getGuideStatusWith(db, OFFICE, issued.id);
  assert.equal(record.current?.receipt, null);
  assert.equal(guideStatusOf(record), "paga");
  // The file is still reachable from the history.
  assert.equal(
    receiptOf(record, "comprovante-errado.pdf")?.displayName,
    "comprovante-errado",
  );

  await withdrawGuideStatusWith(db, OFFICE, issued.id, "u1");
  record = await getGuideStatusWith(db, OFFICE, issued.id);
  assert.equal(guideStatusOf(record), "aguardando-pagamento");
  assert.deepEqual(
    record.history.map((h) => h.change),
    ["receipt-removed", "withdrawn"],
  );

  const trail = await db
    .select({ action: auditLog.action })
    .from(auditLog)
    .where(
      and(eq(auditLog.tenantSlug, OFFICE), eq(auditLog.targetId, issued.id)),
    );
  const actions = trail.map((t) => t.action);
  for (const action of [
    "tax-guide.status",
    "tax-guide.receipt-attach",
    "tax-guide.receipt-withdrawn",
    "tax-guide.status-withdrawn",
  ]) {
    assert.ok(actions.includes(action), action);
  }
});

test("paga pede o dia do pagamento; concluída pede o dia do ato", () => {
  assert.equal(
    guideStatusInputSchema.safeParse({ status: "paga" }).success,
    false,
  );
  assert.equal(
    guideStatusInputSchema.safeParse({
      status: "concluida",
      paidOn: "2026-11-20",
    }).success,
    false,
  );
  assert.equal(
    guideStatusInputSchema.safeParse({ status: "aguardando-pagamento" })
      .success,
    true,
  );
});

test("guia de outra serventia não recebe situação", async () => {
  const issued = await issueGuideWith(db, OFFICE, guide, "u1");
  await assert.rejects(
    setGuideStatusWith(
      db,
      "outra-serventia",
      issued.id,
      guideStatusInputSchema.parse({ status: "aguardando-pagamento" }),
      "u1",
    ),
    GuideStatusError,
  );
});
