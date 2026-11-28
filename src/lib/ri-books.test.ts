import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { EMPTY_AUX } from "@/core/ri/auxiliary.ts";
import { termSignaturesOf } from "@/core/ri/books.ts";
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
  markTermSignedWith,
  openBooksForAcervoWith,
  openBookWith,
  openIndexBooksWith,
  openProtocolVolumesWith,
  protocolDaysWith,
  protocolVolumeOf,
  readBookInput,
  reopenBookWith,
  setBookDeletedWith,
  unmarkTermSignedWith,
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

test("os Livros 4 e 5 abrem uma vez só, na data do Livro 2, em meio eletrônico", async () => {
  const T = "cartorio-teste-indicadores";
  assert.equal(await openIndexBooksWith(db, T, ACTOR), 0);
  await openBookWith(
    db,
    T,
    readBookInput(
      { book: 2, volume: "2", form: "fichas", openedOn: "30/04/2026" },
      "2026-11-27",
    ),
    ACTOR,
  );
  assert.equal(await openIndexBooksWith(db, T, ACTOR), 2);
  const rows = await listBooksWith(db, T);
  for (const n of [4, 5]) {
    const r = rows.find((x) => x.book === n);
    assert.equal(r?.openedOn, "2026-04-30");
    assert.equal(r?.form, "eletronico");
    assert.equal(r?.volume, String(n));
  }
  assert.equal(await openIndexBooksWith(db, T, ACTOR), 0);
});

test("Livro 1: volume pelo número, com 1, 1-B e Livro 1-C", () => {
  assert.equal(protocolVolumeOf("1"), "1");
  assert.equal(protocolVolumeOf("01"), "1");
  assert.equal(protocolVolumeOf("Livro 1-b"), "1-B");
  assert.equal(protocolVolumeOf("livro nº 1 - C"), "1-C");
  assert.equal(protocolVolumeOf("b"), "1-B");
  assert.equal(protocolVolumeOf("2"), null);
});

test("Livro 1: abre os volumes pelos números, com as datas dos títulos", async () => {
  const T = "cartorio-teste-volumes";
  const { importProtocolsWith } = await import("./ri-protocols.ts");
  const item = (number: number, presentedOn: string) => ({
    number,
    presentedOn,
    presenter: "Pessoa Fictícia",
    titleKind: "Escritura",
    acts: "Registrado",
    status: "registrado" as const,
    voided: false,
  });
  await importProtocolsWith(
    db,
    T,
    [
      item(10, "2001-03-05"),
      item(11, "2007-07-26"),
      item(12, "2007-08-02"),
      item(13, "2024-06-28"),
      item(14, "2024-07-04"),
    ],
    ACTOR,
  );
  const r = await openProtocolVolumesWith(
    db,
    T,
    [
      { volume: "1-B", first: 12, last: 13, form: "folhas", sheetCount: 200 },
      { volume: "1", first: 10, last: 11, form: "folhas", sheetCount: 200 },
      {
        volume: "1-C",
        first: 14,
        last: null,
        form: "eletronico",
        sheetCount: 0,
      },
    ],
    ACTOR,
    "2026-11-27",
  );
  assert.deepEqual(r.opened, ["1", "1-B", "1-C"]);
  const books = (await listBooksWith(db, T)).filter((b) => b.book === 1);
  const by = new Map(books.map((b) => [b.volume, b]));
  assert.equal(by.get("1")?.openedOn, "2001-03-05");
  assert.equal(by.get("1")?.closedOn, "2007-07-26");
  assert.equal(by.get("1-B")?.openedOn, "2007-08-02");
  assert.equal(by.get("1-B")?.closedOn, "2024-06-28");
  assert.equal(by.get("1-C")?.closedOn, null);
  assert.equal(by.get("1-C")?.firstItem, 14);
  // Again: nothing changes.
  const again = await openProtocolVolumesWith(
    db,
    T,
    [{ volume: "1", first: 10, last: 11, form: "folhas", sheetCount: 0 }],
    ACTOR,
    "2026-11-27",
  );
  assert.deepEqual(again, { opened: [], kept: ["1"] });
});

test("lote importado: o Livro 2 nunca aberto abre sozinho, uma vez só", async () => {
  const T = "cartorio-teste-lote";
  for (const number of [12, 10, 11]) {
    await createPropertyWith(db, T, { ...base, number }, ACTOR);
  }
  assert.deepEqual(await openBooksForAcervoWith(db, T, ACTOR, "2026-11-27"), [
    "Livro 2",
  ]);
  const [book] = (await listBooksWith(db, T)).filter((b) => b.book === 2);
  assert.equal(book?.firstItem, 10);
  assert.equal(book?.form, "fichas");
  assert.deepEqual(
    await openBooksForAcervoWith(db, T, ACTOR, "2026-11-27"),
    [],
  );
});

test("vários Livros 1, com ou sem letra; termo marcado como assinado e desmarcado com histórico", async () => {
  const T = "cartorio-teste-livro-1-repetido";
  const input = (volume: string, openedOn: string) =>
    readBookInput({ book: 1, volume, form: "folhas", openedOn }, "2026-11-28");
  const a = await openBookWith(db, T, input("1", "10/01/2010"), ACTOR);
  const b = await openBookWith(db, T, input("1", "20/12/2018"), ACTOR);
  const c = await openBookWith(db, T, input("1-B", "22/07/2024"), ACTOR);
  assert.equal((await listBooksWith(db, T)).length, 3);
  // The Livro 2 still takes each number once.
  await openBookWith(
    db,
    T,
    readBookInput(
      { book: 2, volume: "2", openedOn: "01/01/2010" },
      "2026-11-28",
    ),
    ACTOR,
  );
  await assert.rejects(
    openBookWith(
      db,
      T,
      readBookInput(
        { book: 2, volume: "2", openedOn: "01/01/2011" },
        "2026-11-28",
      ),
      ACTOR,
    ),
    RiError,
  );
  // A número typed wrong, corrected with the reason.
  await updateBookWith(
    db,
    T,
    b,
    input("1-A", "20/12/2018"),
    ACTOR,
    "número digitado errado",
  );
  const fixed = await bookWith(db, T, b);
  assert.equal(fixed?.volume, "1-A");
  assert.match(historyOf(fixed!).at(-1)?.what ?? "", /número digitado errado/);

  await markTermSignedWith(db, T, c, "abertura", "digital", ACTOR);
  let row = await bookWith(db, T, c);
  assert.equal(
    termSignaturesOf(row?.termSignatures).abertura?.format,
    "digital",
  );
  await markTermSignedWith(db, T, c, "abertura", "manual", ACTOR);
  row = await bookWith(db, T, c);
  assert.equal(
    termSignaturesOf(row?.termSignatures).abertura?.format,
    "manual",
  );
  assert.match(historyOf(row!).at(-1)?.what ?? "", /assinou de novo/);
  await unmarkTermSignedWith(db, T, c, "abertura", "marcado por engano", ACTOR);
  row = await bookWith(db, T, c);
  assert.equal(termSignaturesOf(row?.termSignatures).abertura, undefined);
  await assert.rejects(
    markTermSignedWith(db, T, a, "encerramento", "digital", ACTOR),
    RiError,
  );
});
