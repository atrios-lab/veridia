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
  protocolPeriodPdfFor,
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
  // Not set yet: the volume is numbered all the same, from folha 1.
  assert.ok(await bookSheetsWith(db, tenant, id));
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
  // The one before, on paper, from folha 1 of the volume; the part the
  // system writes starts on the folha set (75).
  assert.equal(placeOf(sheets.pagination, 2549)?.sheet, 1);
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

test("Protocolo do dia no modelo da Lei 6.015, mesmo sem folhas definidas", async () => {
  const other = { ...tenant, slug: "cartorio-teste-dia" };
  await importProtocolsWith(
    db,
    other.slug,
    [
      {
        number: 7,
        presentedOn: "2025-03-10",
        presenter: "Pessoa Fictícia",
        titleKind: "Escritura",
        acts: "",
        status: "prenotado",
        voided: false,
      },
    ],
    ACTOR,
  );
  const pdf = await protocolPeriodPdfFor(db, other, {
    from: "2025-03-10",
    to: "2025-03-10",
  });
  assert.equal(Buffer.from(pdf.slice(0, 5)).toString(), "%PDF-");
  // An empty day still prints the face with its heading.
  const empty = await protocolPeriodPdfFor(db, other, {
    from: "2025-03-11",
    to: "2025-03-11",
  });
  assert.ok(empty.length > 1000);
});

test("a folha do livro de papel vinda da importação é respeitada", async () => {
  const other = { ...tenant, slug: "cartorio-teste-folha-papel" };
  const id = await openBookWith(
    db,
    other.slug,
    readBookInput(
      {
        book: 1,
        volume: "1",
        form: "folhas",
        sheetCount: "200",
        firstItem: "1",
        openedOn: "1976-09-10",
      },
      "2026-11-27",
    ),
    ACTOR,
  );
  const item = (number: number, sheet?: string) => ({
    number,
    presentedOn: "1976-09-10",
    presenter: `Pessoa Fictícia ${number}`,
    titleKind: "Escritura",
    acts: "",
    status: "registrado" as const,
    voided: false,
    sheet,
  });
  await importProtocolsWith(
    db,
    other.slug,
    [item(1), item(2, "3-v"), item(3)],
    ACTOR,
  );
  const sheets = await bookSheetsWith(db, other, id);
  assert.ok(sheets);
  assert.deepEqual(
    [1, 2, 3].map((n) => {
      const p = placeOf(sheets.pagination, n);
      return [p?.sheet, p?.side];
    }),
    [
      [1, "frente"],
      [3, "verso"],
      [3, "verso"],
    ],
  );
});
