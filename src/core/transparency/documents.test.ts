import assert from "node:assert/strict";
import { test } from "node:test";
import { canPublish, canUnpublish, isDocumentCategory } from "./documents.ts";

test("publish is legal from draft or unpublished, never from published", () => {
  assert.equal(canPublish("draft"), true);
  assert.equal(canPublish("unpublished"), true);
  assert.equal(canPublish("published"), false);
});

test("unpublish is legal only from published", () => {
  assert.equal(canUnpublish("published"), true);
  assert.equal(canUnpublish("draft"), false);
  assert.equal(canUnpublish("unpublished"), false);
});

test("category guard accepts the fixed list and rejects free text", () => {
  assert.equal(isDocumentCategory("Tabela de emolumentos"), true);
  assert.equal(isDocumentCategory("Aviso"), true);
  assert.equal(isDocumentCategory("Qualquer coisa"), false);
  assert.equal(isDocumentCategory(""), false);
});
