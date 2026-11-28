import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CUSTAS_NOTE_GENERIC,
  CUSTAS_NOTE_MAX,
  CUSTAS_NOTE_RN,
  custasNoteFrom,
  custasNoteOfUrl,
  defaultCustasNote,
} from "./closing-notes.ts";

test("a nota de custas vem pronta: a do TJRN no RN, uma simples fora", () => {
  assert.equal(defaultCustasNote("rn"), CUSTAS_NOTE_RN);
  assert.equal(defaultCustasNote("PB"), CUSTAS_NOTE_GENERIC);
});

test("sem clicar no botão, o documento sai sem nota", () => {
  assert.equal(custasNoteFrom(null), null);
  assert.equal(custasNoteFrom("   "), null);
  assert.equal(custasNoteOfUrl("https://x.test/a?assinatura=digital"), null);
});

test("a nota editada pelo funcionário vai como ele escreveu", () => {
  const url = `https://x.test/a?custas=${encodeURIComponent(" Custas pagas.\r\nSelo X. ")}`;
  assert.equal(custasNoteOfUrl(url), "Custas pagas.\nSelo X.");
  assert.equal(custasNoteFrom("a".repeat(5000))?.length, CUSTAS_NOTE_MAX);
});
