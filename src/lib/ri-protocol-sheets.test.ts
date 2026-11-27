import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { after, before, test } from "node:test";
import { placeOf } from "@/core/ri/protocol-sheets.ts";
import { tabelionatoAurora } from "@/core/tenant/tenants/aurora.ts";
import type { Database } from "@/db/index.ts";
import { createTestDb } from "@/db/test-db.ts";
import { openBookWith, readBookInput } from "./ri-books.ts";
import { closeDaysWith } from "./ri-protocol-days.ts";
import {
  bookSheetsPdf,
  bookSheetsWith,
  dayTermText,
  setBookPagingWith,
} from "./ri-protocol-sheets.ts";
import { importProtocolsWith } from "./ri-protocols.ts";

let db: Database;
let close: () => Promise<void>;
before(async () => {
  ({ db, close } = await createTestDb());
});
after(async () => {
  await close();
});

// Fictitious data only (LGPD).
const tenant = { ...tabelionatoAurora, slug: "cartorio-teste-folhas" };
const ACTOR = { id: "u-oficial" };

test("termo do dia como o carimbo do livro", () => {
  assert.equal(
    dayTermText("2018-12-19", 2, "Cidade/UF"),
    "Termo de encerramento. Declaro encerrado o expediente de hoje, protocolando 2 títulos. Cidade/UF, 19/12/2018.",
  );
  assert.match(dayTermText("2018-12-20", 0, "Cidade/UF"), /sem movimento/);
});

test("folhas do Livro 1: onde cai cada protocolo e o PDF das faces", async () => {
  const id = await openBookWith(
    db,
    tenant.slug,
    readBookInput(
      {
        book: 1,
        volume: "1-B",
        form: "hibrido",
        sheetCount: "200",
        firstItem: "1689",
        openedOn: "2007-08-02",
      },
      "2026-11-27",
    ),
    ACTOR,
  );
  // Not set yet: no folhas.
  assert.equal(await bookSheetsWith(db, tenant, id), null);
  const item = (number: number, presentedOn: string) => ({
    number,
    presentedOn,
    presenter: `Pessoa Fictícia ${number}`,
    titleKind: "Escritura de compra e venda",
    acts: "",
    status: "prenotado" as const,
    voided: false,
  });
  await importProtocolsWith(
    db,
    tenant.slug,
    [
      item(2549, "2024-06-28"),
      item(2550, "2024-07-04"),
      item(2551, "2024-07-04"),
      item(2552, "2024-07-08"),
    ],
    ACTOR,
  );
  await closeDaysWith(
    db,
    tenant.slug,
    { from: "2024-07-04", to: "2024-07-08" },
    {},
    ACTOR,
    "2026-11-27",
  );
  await setBookPagingWith(
    db,
    tenant.slug,
    id,
    { fromItem: 2550, fromSheet: 75, fromSide: "frente" },
    ACTOR,
  );
  const sheets = await bookSheetsWith(db, tenant, id);
  assert.ok(sheets);
  // The one before, on paper, is not laid out.
  assert.equal(placeOf(sheets.pagination, 2549), null);
  // 2550 and 2551 on the 4th, the termo of the 4th (2 títulos), then the
  // termos of the 5th, 6th and 7th (sem movimento), then 2552 on the 8th.
  const at = (n: number) => {
    const p = placeOf(sheets.pagination, n);
    return [p?.sheet, p?.side, p?.line];
  };
  assert.deepEqual(at(2550), [75, "frente", 0]);
  assert.deepEqual(at(2551), [75, "frente", 3]);
  const termos = sheets.pagination.items.filter((i) => i.kind === "termo");
  assert.equal(termos.length, 5);
  assert.match(
    termos[0]?.kind === "termo" ? termos[0].closing.text : "",
    /protocolando 2 títulos/,
  );
  assert.match(
    termos[1]?.kind === "termo" ? termos[1].closing.text : "",
    /sem movimento/,
  );
  const termLines = termos.reduce((n, t) => n + t.lines, 0);
  assert.deepEqual(at(2552), [
    75,
    "frente",
    6 + termLines - (termos[4]?.lines ?? 0),
  ]);
  const pdf = await bookSheetsPdf(tenant, sheets);
  assert.ok(pdf && pdf.length > 1000);
  assert.equal(Buffer.from(pdf.slice(0, 5)).toString(), "%PDF-");
  if (process.env.SHEETS_PDF) writeFileSync(process.env.SHEETS_PDF, pdf);
});
