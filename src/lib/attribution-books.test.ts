import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { bookOf, readEntry } from "@/core/books/catalog.ts";
import type { Database } from "@/db/index.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  createBookEntryWith,
  entryInputOf,
  importBookEntriesWith,
  listBookEntriesWith,
  setBookEntryDeletedWith,
  updateBookEntryWith,
} from "./attribution-books.ts";

let db: Database;
let close: () => Promise<void>;
before(async () => {
  ({ db, close } = await createTestDb());
});
after(async () => {
  await close();
});

// Fictitious data only (LGPD).
const T = "cartorio-teste-livros";
const ACTOR = { id: "u-oficial" };
const book = bookOf("notas", "escrituras");
if (!book) throw new Error("livro de escrituras ausente");
const entry = (n: number, extra: Record<string, string> = {}) =>
  readEntry(
    book,
    {
      numero: String(n),
      data: "10/03/2026",
      natureza: "Compra e venda",
      partes: "Pessoa A e Pessoa B",
      ...extra,
    },
    "2026-11-27",
  );

test("lança, altera com histórico e apaga sem tirar do banco", async () => {
  const id = await createBookEntryWith(db, T, book, entry(1), ACTOR);
  await assert.rejects(createBookEntryWith(db, T, book, entry(1), ACTOR));
  await updateBookEntryWith(
    db,
    T,
    book,
    id,
    entry(1, { valor: "R$ 100,00" }),
    "Valor faltava",
    ACTOR,
  );
  const [row] = await listBookEntriesWith(db, T, book);
  assert.equal(entryInputOf(row as never).data.valor, "R$ 100,00");
  assert.equal((row?.history as unknown[]).length, 1);
  await setBookEntryDeletedWith(db, T, book, id, true, "Duplicado", ACTOR);
  assert.equal((await listBookEntriesWith(db, T, book)).length, 0);
  assert.equal(
    (await listBookEntriesWith(db, T, book, { deleted: true })).length,
    1,
  );
});

test("importar: conferir não grava; novos não mexe; completar só preenche vazio", async () => {
  const T2 = "cartorio-teste-livros-import";
  await createBookEntryWith(db, T2, book, entry(1, { objeto: "" }), ACTOR);
  const items = [entry(1, { objeto: "Lote 4", natureza: "Doação" }), entry(2)];
  const check = await importBookEntriesWith(
    db,
    T2,
    book,
    items,
    "conferir",
    ACTOR,
  );
  assert.deepEqual(check, { created: 1, completed: 1, unchanged: 0 });
  assert.equal((await listBookEntriesWith(db, T2, book)).length, 1);
  await importBookEntriesWith(db, T2, book, items, "novos", ACTOR);
  let rows = await listBookEntriesWith(db, T2, book);
  assert.equal(rows.length, 2);
  assert.equal(entryInputOf(rows[0] as never).data.objeto, "");
  await importBookEntriesWith(db, T2, book, items, "completar", ACTOR);
  rows = await listBookEntriesWith(db, T2, book);
  const first = entryInputOf(rows[0] as never).data;
  assert.equal(first.objeto, "Lote 4");
  assert.equal(first.natureza, "Compra e venda");
});
