import assert from "node:assert/strict";
import { test } from "node:test";
import { requirementTextSchema } from "./requirement.ts";

test("requirement text is trimmed and collapsed", () => {
  const parsed = requirementTextSchema.parse("  Falta   cópia do RG  ");
  assert.equal(parsed, "Falta cópia do RG");
});

test("empty requirement text is refused", () => {
  assert.equal(requirementTextSchema.safeParse("   ").success, false);
});

test("requirement text has a length ceiling", () => {
  assert.equal(requirementTextSchema.safeParse("a".repeat(501)).success, false);
  assert.ok(requirementTextSchema.safeParse("a".repeat(500)).success);
});
