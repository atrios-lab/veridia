import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { EMPTY_AUX } from "@/core/ri/auxiliary.ts";
import { EMPTY_CONDO, EMPTY_RURAL } from "@/core/ri/property.ts";
import type { Database } from "@/db/index.ts";
import { riProtocols } from "@/db/schema.ts";
import { createTestDb } from "@/db/test-db.ts";
import { createPropertyWith, RiError } from "./ri.ts";
import {
  bookFichasWith,
  bookWith,
  closeBookWith,
  historyOf,
  listBooksWith,
  openBookWith,
  protocolDaysWith,
  readBookInput,
  reopenBookWith,
  setBookDeletedWith,
  updateBookWith,
} from "./ri-books.ts";

let db: Database;
let close: () => Promise<void>;
before(async () => {
  ({ db, close } = await createTestDb());
});
after(async () => {
  await close();
});

// Fictitious data only (LGPD).
const TENANT = "cartorio-teste-ri-livros";
const ACTOR = { id: "u-oficial" };
const base = {
  book: 2 as const,
  recordKind: 1,
  status: 0,
  cnm: "",
  cnmInPgv: false,
  openedOn: "2001-01-01",
  origin: "",
  ficha: "",
  location: 1,
  propertyKind: 9,
  streetKind: 177,
  street: "Rua Exemplo",
  streetNumber: "",
  district: "Zona Rural",
  cep: "",
  complement: "",
  quadra: "",
  setor: "",
  conjunto: "",
  lote: "",
  loteamento: "",
  contributors: [],
  rural: { ...EMPTY_RURAL },
  condo: { ...EMPTY_CONDO },
  area: "1 ha",
  auxKind: "",
  linkedNumbers: "",
  priorActs: 0,
  aux: { ...EMPTY_AUX, parties: [] },
  description: "",
  notes: "",
};

test("the form: book, number with letter, dates", () => {
  const today = "2026-11-26";
  const input = readBookInput(
    {
      book: "2",
      volume: "2-a",
      form: "folhas",
      sheetCount: "300",
      firstItem: "1.001",
      openedOn: "01/11/2026",
    },
    today,
  );
  assert.equal(input.volume, "2-A");
  assert.equal(input.sheetCount, 300);
  assert.equal(input.firstItem, 1001);
  assert.equal(input.openedOn, "2026-11-01");
  assert.throws(
    () => readBookInput({ book: "2", volume: "3-A" }, today),
    RiError,
  );
  assert.throws(
    () => readBookInput({ book: "9", volume: "9" }, today),
    RiError,
  );
  assert.throws(
    () =>
      readBookInput({ book: "2", volume: "2", openedOn: "27/11/2026" }, today),
    /depois de hoje/,
  );
  assert.throws(
    () =>
      readBookInput(
        { book: "2", volume: "2", firstItem: "10", lastItem: "5" },
        today,
      ),
    /menor/,
  );
});

test("open, change, close, reopen and hide a book; nothing is deleted", async () => {
  const input = readBookInput({
    book: "2",
    volume: "2-A",
    form: "fichas",
    firstItem: "1",
    openedOn: "01/01/2026",
  });
  const id = await openBookWith(db, TENANT, input, ACTOR);
  await assert.rejects(
    openBookWith(db, TENANT, input, ACTOR),
    /já está aberto/,
  );

  await updateBookWith(db, TENANT, id, { ...input, sheetCount: 200 }, ACTOR);
  let row = await bookWith(db, TENANT, id);
  assert.equal(row?.sheetCount, 200);
  assert.equal(historyOf(row ?? { history: [] })[0]?.before.sheetCount, 0);

  await assert.rejects(
    closeBookWith(
      db,
      TENANT,
      id,
      { closedOn: "01/02/2026", lastSheet: 250, lastItem: null, notes: "" },
      ACTOR,
    ),
    /passa do número de folhas/,
  );
  await closeBookWith(
    db,
    TENANT,
    id,
    { closedOn: "01/02/2026", lastSheet: 180, lastItem: 2, notes: "Fim." },
    ACTOR,
  );
  row = await bookWith(db, TENANT, id);
  assert.equal(row?.closedOn, "2026-02-01");
  assert.equal(row?.lastItem, 2);

  await reopenBookWith(db, TENANT, id, ACTOR);
  row = await bookWith(db, TENANT, id);
  assert.equal(row?.closedOn, null);
  assert.match(
    historyOf(row ?? { history: [] }).at(-1)?.what ?? "",
    /desfez o encerramento de 01\/02\/2026.*Fim\./,
  );

  await setBookDeletedWith(db, TENANT, id, true, ACTOR);
  assert.ok((await bookWith(db, TENANT, id))?.deletedAt);
  // The number is free again while it is hidden; restoring checks it.
  const other = await openBookWith(db, TENANT, input, ACTOR);
  await assert.rejects(
    setBookDeletedWith(db, TENANT, id, false, ACTOR),
    /outro livro/,
  );
  await setBookDeletedWith(db, TENANT, other, true, ACTOR);
  await setBookDeletedWith(db, TENANT, id, false, ACTOR);
  assert.equal((await listBooksWith(db, TENANT)).length, 2);
});

test("the fichas of a volume and the days of the Protocolo", async () => {
  for (const number of [1, 2, 3, 10]) {
    await createPropertyWith(db, TENANT, { ...base, number }, ACTOR);
  }
  const id = await openBookWith(
    db,
    TENANT,
    readBookInput({
      book: "2",
      volume: "2-B",
      firstItem: "2",
      lastItem: "3",
      openedOn: "01/01/2026",
    }),
    ACTOR,
  );
  const row = await bookWith(db, TENANT, id);
  assert.ok(row);
  const fichas = await bookFichasWith(db, TENANT, row);
  assert.deepEqual(
    fichas.map((f) => f.number),
    [2, 3],
  );

  const entry = {
    tenantSlug: TENANT,
    presenterName: "Pessoa Exemplo",
    titleKind: "Escritura pública",
  };
  await db.insert(riProtocols).values([
    { ...entry, number: 1, presentedOn: "2026-11-20" },
    { ...entry, number: 2, presentedOn: "2026-11-20", voidedAt: new Date() },
    { ...entry, number: 3, presentedOn: "2026-11-21" },
    { ...entry, kind: "exame", number: 1, presentedOn: "2026-11-20" },
  ]);
  const days = await protocolDaysWith(db, TENANT, "2026-11-20", "2026-11-20");
  const lines = days.get("2026-11-20") ?? [];
  // Exame e cálculo is not apontado (art. 12, parágrafo único).
  assert.deepEqual(
    lines.map((l) => [l.number, l.voided]),
    [
      [1, false],
      [2, true],
    ],
  );
  assert.equal(days.has("2026-11-21"), false);
});
