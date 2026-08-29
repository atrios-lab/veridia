import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_MESSAGE_LENGTH } from "../chat/message.ts";
import { requirementTextSchema } from "./requirement.ts";

test("requirement text is trimmed", () => {
  const parsed = requirementTextSchema.parse("  Falta cópia do RG  ");
  assert.equal(parsed, "Falta cópia do RG");
});

test("requirement text keeps the line breaks the office typed", () => {
  const written = "Faltam dois documentos:\n\n1. Certidão\n2. Procuração";
  assert.equal(requirementTextSchema.parse(written), written);
});

test("empty requirement text is refused", () => {
  assert.equal(requirementTextSchema.safeParse("   ").success, false);
});

test("requirement text has a length ceiling", () => {
  assert.ok(
    requirementTextSchema.safeParse("a".repeat(MAX_MESSAGE_LENGTH)).success,
  );
  assert.equal(
    requirementTextSchema.safeParse("a".repeat(MAX_MESSAGE_LENGTH + 1)).success,
    false,
  );
});

test("the ceiling error says how long is too long", () => {
  const parsed = requirementTextSchema.safeParse(
    "a".repeat(MAX_MESSAGE_LENGTH + 1),
  );
  assert.ok(!parsed.success);
  assert.match(parsed.error.issues[0].message, /4\.000/);
});
