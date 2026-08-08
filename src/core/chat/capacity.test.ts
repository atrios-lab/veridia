import assert from "node:assert/strict";
import { test } from "node:test";
import { canAssign, MAX_CONCURRENT_CONVERSATIONS } from "./capacity.ts";

test("an attendant with no conversations may take one", () => {
  assert.equal(canAssign(0), true);
});

test("an attendant one below the limit may take one more", () => {
  assert.equal(canAssign(MAX_CONCURRENT_CONVERSATIONS - 1), true);
});

test("an attendant at the limit may not take another", () => {
  assert.equal(canAssign(MAX_CONCURRENT_CONVERSATIONS), false);
});

test("the limit is three", () => {
  assert.equal(MAX_CONCURRENT_CONVERSATIONS, 3);
});
