import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { parseSealLookup, type Seal } from "../core/seal/parse.ts";

/**
 * The parser against real pages captured from the TJRN's SIEX.
 *
 * It lives on this side and not next to `parse.ts` because the fixtures are
 * not domain data: they are recordings of somebody else's system, and reading
 * them is I/O, which `src/core` does not do. The parser stays pure; the
 * evidence that it still matches the TJ's markup belongs at the boundary.
 *
 * Recapture with `pnpm capture:seal` when the TJ changes the page.
 */

// The SIEX answers in iso-8859-1, which the client decodes before parsing.
// "latin1" reproduces that decoding, so a fixture reaches the parser exactly
// as a live response would.
function fixture(name: string): string {
  return readFileSync(join(import.meta.dirname, "fixtures", name), "latin1");
}

function sealOf(html: string): Seal {
  const result = parseSealLookup(html);
  assert.equal(result.kind, "seals");
  assert.equal(result.seals.length, 1);
  return result.seals[0];
}

test("a wrong captcha comes back as the TJ's own message", () => {
  const result = parseSealLookup(fixture("seal-wrong-captcha.html"));
  assert.equal(result.kind, "message");
  assert.equal(result.text, "O valor inserido não corresponde ao da imagem.");
});

test("the lookup page with no result is not mistaken for one", () => {
  assert.equal(parseSealLookup(fixture("seal-form.html")).kind, "unrecognized");
});

test("anything else is unrecognized, never an exception", () => {
  for (const html of [
    "",
    "<html><body>oi</body></html>",
    "{}",
    "<h3>Código:",
  ]) {
    assert.equal(parseSealLookup(html).kind, "unrecognized");
  }
});

test("the seal carries its code and the note the TJ appends", () => {
  const seal = sealOf(fixture("seal-success.html"));
  assert.equal(seal.code, "RN202600946150001796UXB");
  assert.equal(seal.note, "Atualizado");
});

test("the opening fields land before any section heading", () => {
  const [opening] = sealOf(fixture("seal-success.html")).sections;
  assert.equal(opening.title, undefined);
  assert.deepEqual(
    opening.fields.find((f) => f.label === "Cartório"),
    { label: "Cartório", value: "IELMO MARINHO - OFÍCIO ÚNICO" },
  );
  assert.deepEqual(
    opening.fields.find((f) => f.label === "Lote de Geração"),
    { label: "Lote de Geração", value: "1236684" },
  );
});

test("the headings of the block become sections, in order", () => {
  const seal = sealOf(fixture("seal-success.html"));
  assert.deepEqual(
    seal.sections.map((s) => s.title),
    [
      undefined,
      "Guias associadas",
      "Selos vinculados",
      "Lançamentos realizados (Ativos)",
    ],
  );
});

test("a heading with nothing under it survives as an empty section", () => {
  const linked = sealOf(fixture("seal-success.html")).sections.find(
    (s) => s.title === "Selos vinculados",
  );
  assert.ok(linked);
  assert.equal(linked.fields.length, 0);
  assert.equal(linked.notes.length, 0);
});

test("a line that is not a field is kept as a note", () => {
  const entries = sealOf(fixture("seal-success.html")).sections.find(
    (s) => s.title === "Lançamentos realizados (Ativos)",
  );
  assert.ok(entries);
  assert.deepEqual(entries.notes, ["1 lançamento(s)"]);
});

// The TJ writes "R$ 0,05" and "R$ 4.21" on the same page. Parsing those into
// numbers would have to pick a decimal separator, and picking wrong turns
// four reais into four hundred. The citizen compares against the document.
test("money is passed through exactly as the TJ wrote it", () => {
  const seal = sealOf(fixture("seal-success.html"));
  const value = (label: string) =>
    seal.sections.flatMap((s) => s.fields).find((f) => f.label === label)
      ?.value;
  assert.equal(value("Valor selo"), "R$ 0,05");
  assert.equal(value("Valor dos Emolumentos"), "R$ 4.21");
  assert.equal(value("Valor Total"), "R$ 4.42");
});

test("a value with its own colons is not cut short", () => {
  const seal = sealOf(fixture("seal-success.html"));
  const generated = seal.sections[0].fields.find(
    (f) => f.label === "Gerado em",
  );
  assert.equal(generated?.value, "05/01/2026 09:05:41");
});
