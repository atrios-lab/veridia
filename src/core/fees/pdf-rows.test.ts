import assert from "node:assert/strict";
import { test } from "node:test";
import { type PdfTextPiece, rowsOfPage } from "./pdf-rows.ts";

function piece(str: string, x: number, y: number, width: number): PdfTextPiece {
  return { str, transform: [9, 0, 0, 9, x, y], width, height: 9 };
}

test("cells handed out column by column come back as rows", () => {
  const rows = rowsOfPage([
    piece("2600102", 30, 700, 35),
    piece("2600103", 30, 670, 35),
    piece("Busca", 90, 700, 25),
    piece("Prenotação", 90, 670, 45),
    piece("12,50", 300, 700, 22),
    piece("57,90", 300, 670.5, 22),
  ]);
  assert.deepEqual(rows, ["2600102 Busca 12,50", "2600103 Prenotação 57,90"]);
});

test("a word the file split in two stays one word", () => {
  assert.deepEqual(
    rowsOfPage([piece("Prenota", 90, 670, 32), piece("ção", 122.2, 670, 13)]),
    ["Prenotação"],
  );
});

test("empty pieces and line breaks are not text", () => {
  assert.deepEqual(
    rowsOfPage([piece(" ", 10, 10, 2), piece("", 20, 10, 0)]),
    [],
  );
});
