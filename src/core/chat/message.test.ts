import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_MESSAGE_LENGTH, messageBodySchema } from "./message.ts";

test("a normal message is accepted", () => {
  assert.equal(messageBodySchema.safeParse("Bom dia!").success, true);
});

test("an empty message is refused", () => {
  assert.equal(messageBodySchema.safeParse("   ").success, false);
});

test("a message has a length ceiling", () => {
  assert.equal(
    messageBodySchema.safeParse("a".repeat(MAX_MESSAGE_LENGTH)).success,
    true,
  );
  assert.equal(
    messageBodySchema.safeParse("a".repeat(MAX_MESSAGE_LENGTH + 1)).success,
    false,
  );
});

test("surrounding whitespace is trimmed", () => {
  assert.equal(messageBodySchema.parse("  Olá  "), "Olá");
});
