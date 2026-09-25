import assert from "node:assert/strict";
import { test } from "node:test";
import { groupByRubric, parseFundAmounts } from "./rubrics.ts";

const EXAMPLE = { fdj: 123_456, frmp: 32_100, fcrcpn: 21_040, funaf: 9_810 };

test("RN funds group into II, III and IV, with the spec's subtotals", () => {
  const { rubrics, totalCents } = groupByRubric("RN", EXAMPLE);

  assert.deepEqual(
    rubrics.map((r) => [r.rubric, r.subtotalCents]),
    [
      ["II", 123_456],
      ["III", 21_040],
      ["IV", 41_910],
    ],
  );
  assert.deepEqual(
    rubrics[2].funds.map((f) => f.label),
    ["FRMP", "FUNAF"],
  );
  assert.equal(totalCents, 186_406);
});

test("rubric I has no RN fund and is left out, not shown as zero", () => {
  const { rubrics } = groupByRubric("RN", EXAMPLE);
  assert.equal(
    rubrics.some((r) => r.rubric === "I"),
    false,
  );
});

test("parseFundAmounts takes exactly the state's funds", () => {
  assert.deepEqual(parseFundAmounts("RN", EXAMPLE), EXAMPLE);
  assert.deepEqual(
    parseFundAmounts("RN", { fdj: 0, frmp: 0, fcrcpn: 0, funaf: 0 }),
    { fdj: 0, frmp: 0, fcrcpn: 0, funaf: 0 },
  );
});

test("parseFundAmounts refuses a missing, extra or malformed fund", () => {
  const { funaf: _, ...missing } = EXAMPLE;
  assert.equal(parseFundAmounts("RN", missing), null);
  assert.equal(parseFundAmounts("RN", { ...EXAMPLE, iss: 100 }), null);
  assert.equal(parseFundAmounts("RN", { ...EXAMPLE, fdj: 12.5 }), null);
  assert.equal(parseFundAmounts("RN", { ...EXAMPLE, fdj: -1 }), null);
  assert.equal(parseFundAmounts("RN", { ...EXAMPLE, fdj: "100" }), null);
  assert.equal(parseFundAmounts("RN", null), null);
  assert.equal(parseFundAmounts("RN", {}), null);
});
