import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultExpiry } from "./expiry.ts";

test("marriage banns default to 15 days out", () => {
  assert.equal(defaultExpiry("marriageBanns", "2026-08-08"), "2026-08-23");
});

test("notice has no suggested exit date", () => {
  assert.equal(defaultExpiry("notice", "2026-08-08"), undefined);
});

test("public notice has no suggested exit date", () => {
  assert.equal(defaultExpiry("publicNotice", "2026-08-08"), undefined);
});
