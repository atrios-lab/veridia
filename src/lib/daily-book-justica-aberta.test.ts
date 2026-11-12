import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { parseSemester } from "@/core/daily-book/justica-aberta.ts";
import type { Database } from "@/db/index.ts";
import { createTestDb } from "@/db/test-db.ts";
import { entryOf, findEntryWith, listEntriesWith } from "./daily-book.ts";
import {
  justicaAbertaWith,
  removeFcrcpnRepasseWith,
  saveFcrcpnRepasseWith,
} from "./daily-book-justica-aberta.ts";

let db: Database;
let close: () => Promise<void>;
const TENANT = "cartorio-marinho";

before(async () => {
  ({ db, close } = await createTestDb());
});
after(async () => {
  await close();
});

const repasse = {
  receivedOn: "2026-03-10",
  competence: "2026-02",
  payer: "Associação Fictícia",
  receivedCents: 312_220,
  withheldCents: 10_222,
  notes: "",
};

test("repasse do FCRCPN: entra no livro pelo líquido, sem contar ato, e no Justiça Aberta uma vez só", async () => {
  const saved = await saveFcrcpnRepasseWith(db, TENANT, repasse, "u1");
  assert.ok(saved.entryId);
  const row = await findEntryWith(db, TENANT, saved.entryId ?? "");
  assert.equal(row?.kind, "receita");
  assert.equal(row?.source, "fcrcpn");
  assert.equal(row?.amountCents, 312_220);
  assert.equal(row?.quantity, 0);
  assert.equal(row?.occurredOn, "2026-03-10");
  assert.match(row?.description ?? "", /competência 02\/2026/);
  assert.match(
    row?.description ?? "",
    /imposto de renda retido na fonte: R\$ 102,22/,
  );

  const semester = parseSemester("2026-1");
  assert.ok(semester);
  const { figures } = await justicaAbertaWith(db, TENANT, semester);
  const rcpn = figures.specialties.find((s) => s.id === "rcpn");
  assert.equal(rcpn?.ownCents, 0);
  assert.equal(rcpn?.otherCents, 312_220);
  assert.equal(rcpn?.acts, 0);

  // Corrected there, the line follows.
  await saveFcrcpnRepasseWith(
    db,
    TENANT,
    { ...repasse, receivedCents: 300_000 },
    "u1",
    saved.id,
  );
  const again = await findEntryWith(db, TENANT, saved.entryId ?? "");
  assert.equal(again?.amountCents, 300_000);

  // Removed with a reason, the line leaves the book with it; both stay.
  await removeFcrcpnRepasseWith(
    db,
    TENANT,
    saved.id,
    "Lançado em duplicidade",
    "u1",
  );
  const gone = await findEntryWith(db, TENANT, saved.entryId ?? "");
  assert.ok(gone?.removedAt);
  assert.equal(gone?.removeReason, "Lançado em duplicidade");
  const live = (
    await listEntriesWith(db, TENANT, {
      start: "2026-03-01",
      end: "2026-03-31",
    })
  ).map(entryOf);
  assert.equal(
    live.some((e) => e.source === "fcrcpn"),
    false,
  );
});
