import assert from "node:assert/strict";
import { test } from "node:test";
import { splitBold, stripBold } from "./rich.ts";

test("o negrito marcado com ** vira pedaços, e o texto sem marca fica igual", () => {
  assert.deepEqual(splitBold("Vendedor: **JOÃO FICTÍCIO**, CPF 1."), [
    { text: "Vendedor: ", bold: false },
    { text: "JOÃO FICTÍCIO", bold: true },
    { text: ", CPF 1.", bold: false },
  ]);
  assert.deepEqual(splitBold("sem marca"), [
    { text: "sem marca", bold: false },
  ]);
  assert.deepEqual(splitBold("**A** e **B**"), [
    { text: "A", bold: true },
    { text: " e ", bold: false },
    { text: "B", bold: true },
  ]);
  // A mark left open never swallows the rest of the paragraph.
  assert.deepEqual(splitBold("a **b"), [{ text: "a **b", bold: false }]);
  assert.equal(stripBold("de **MARIA**."), "de MARIA.");
});
