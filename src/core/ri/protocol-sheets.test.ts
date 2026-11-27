import assert from "node:assert/strict";
import { test } from "node:test";
import {
  capacityOf,
  DEFAULT_PAGING,
  faceLabel,
  fullFaces,
  paginate,
  pagingOf,
  placeOf,
  SHEET_LAYOUT,
  type SheetEntry,
  wrap,
} from "./protocol-sheets.ts";

// Fictitious data only (LGPD).
const entry = (number: number, presentedOn: string, acts = ""): SheetEntry => ({
  number,
  presentedOn,
  presenter: "Pessoa Fictícia",
  titleKind: "Escritura",
  acts,
  voided: false,
});
const termo = (day: string) => ({
  day,
  text: "Termo de encerramento. Declaro encerrado o expediente de hoje, sem movimento.",
});
const paging = { ...DEFAULT_PAGING, fromItem: 2550, fromSheet: 75 };

test("quebra de linha por caracteres, sem perder palavra", () => {
  assert.deepEqual(wrap("um dois tres quatro", 9), [
    "um dois",
    "tres",
    "quatro",
  ]);
  assert.deepEqual(wrap("abcdefghij", 4), ["abcd", "efgh", "ij"]);
  assert.deepEqual(wrap("", 5), [""]);
});

test("títulos e termos corridos, como no livro: o dia seguinte continua na mesma folha", () => {
  const p = paginate(
    [entry(2550, "2024-07-04"), entry(2551, "2024-07-04")],
    [termo("2024-07-04"), termo("2024-07-05")],
    paging,
  );
  assert.deepEqual(
    p.items.map((i) => [i.kind, i.sheet, i.side, i.line]),
    [
      ["entry", 75, "frente", 0],
      ["entry", 75, "frente", 3],
      ["termo", 75, "frente", 6],
      ["termo", 75, "frente", 10],
    ],
  );
  assert.deepEqual(p.next, { sheet: 75, side: "frente", line: 14 });
  assert.equal(faceLabel(75, "verso"), "75-v");
});

test("o que não cabe vai para o verso e depois para a folha seguinte", () => {
  const per = SHEET_LAYOUT.linesPerSide;
  const many = Array.from({ length: 30 }, (_, i) =>
    entry(2550 + i, "2024-07-04"),
  );
  const p = paginate(many, [], paging);
  const perSide = Math.floor(per / paging.entryLines);
  assert.deepEqual(placeOf(p, 2550 + perSide)?.side, "verso");
  assert.equal(placeOf(p, 2550 + perSide)?.sheet, 75);
  assert.equal(placeOf(p, 2550 + 2 * perSide)?.sheet, 76);
  assert.equal(placeOf(p, 2550 + 2 * perSide)?.side, "frente");
  // Faces already full are ready to print.
  assert.deepEqual(fullFaces(p), [
    { sheet: 75, side: "frente" },
    { sheet: 75, side: "verso" },
  ]);
});

test("título que não cabe no resto da face vai inteiro para a próxima e o resto é inutilizado", () => {
  const per = SHEET_LAYOUT.linesPerSide;
  const fill = Array.from({ length: Math.floor(per / 3) - 1 }, (_, i) =>
    entry(1 + i, "2024-07-04"),
  );
  const long = "palavra ".repeat(40); // 12 lines in Anotações
  const p = paginate([...fill, entry(100, "2024-07-04", long)], [], {
    ...paging,
    fromItem: 1,
    fromSheet: 1,
  });
  const at = placeOf(p, 100);
  assert.equal(at?.side, "verso");
  assert.equal(at?.line, 0);
  assert.ok(
    p.items.some((i) => i.kind === "inutilizado" && i.side === "frente"),
  );
});

test("cada dia em face nova, quando o cartório preferir", () => {
  const p = paginate(
    [entry(1, "2024-07-04"), entry(2, "2024-07-05")],
    [termo("2024-07-04"), termo("2024-07-05")],
    { ...paging, fromItem: 1, fromSheet: 1, dayBreak: "dia" },
  );
  assert.equal(placeOf(p, 2)?.side, "verso");
  assert.equal(placeOf(p, 2)?.line, 0);
});

test("texto maior que uma face continua na seguinte", () => {
  const huge = "x ".repeat(SHEET_LAYOUT.linesPerSide * 20);
  const p = paginate([entry(1, "2024-07-04", huge)], [], {
    ...paging,
    fromItem: 1,
    fromSheet: 1,
  });
  const parts = p.items.filter((i) => i.kind === "entry");
  assert.ok(parts.length >= 2);
  assert.equal(parts[1]?.offset, SHEET_LAYOUT.linesPerSide);
});

test("quantos títulos cabem por face e por folha", () => {
  const c = capacityOf(paging);
  assert.equal(c.perSide, Math.floor(SHEET_LAYOUT.linesPerSide / 3));
  assert.equal(c.perSheet, c.perSide * 2);
  assert.equal(capacityOf({ ...paging, bothSides: false }).perSheet, c.perSide);
});

test("configuração lida com os valores padrão", () => {
  assert.deepEqual(pagingOf({}), DEFAULT_PAGING);
  const p = pagingOf({
    fromItem: "2550",
    fromSheet: "75",
    fromSide: "verso",
    entryLines: 99,
  });
  assert.equal(p.fromItem, 2550);
  assert.equal(p.fromSheet, 75);
  assert.equal(p.fromSide, "verso");
  assert.equal(p.entryLines, DEFAULT_PAGING.entryLines);
});
