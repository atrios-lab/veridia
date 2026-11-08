import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultExpiry } from "./expiry.ts";

test("marriage banns default to 15 days out", () => {
  // Saturday 2026-08-08 + 15 = Sunday 08-23: due day moves to Monday.
  assert.equal(
    defaultExpiry("proclamas-casamento", "2026-08-08"),
    "2026-08-24",
  );
  assert.equal(
    defaultExpiry("proclamas-casamento", "2026-08-10"),
    "2026-08-25",
  );
});

test("usucapião notified by edital runs twice, 15 business days each", () => {
  // Runs 10-20 and 11-11; the term ends 12-03 (11-02 and 11-20 skipped).
  assert.equal(
    defaultExpiry("usucapiao-notificacao", "2026-10-20"),
    "2026-12-03",
  );
});

test("notice and an edital with no rule have no suggested exit date", () => {
  assert.equal(defaultExpiry(null, "2026-08-08"), undefined);
  assert.equal(defaultExpiry("sem-regra", "2026-08-08"), undefined);
});
