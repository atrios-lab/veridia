import assert from "node:assert/strict";
import { test } from "node:test";
import { cnmOf, cnmsInText } from "./cnm.ts";

test("lê os CNM desta serventia num arquivo do PGV", () => {
  const cns = "123456";
  const a = cnmOf(cns, 2, 1);
  const b = cnmOf(cns, 2, 25).replace(/\D/g, "");
  const other = cnmOf("654321", 2, 3);
  const text = `matricula;cnm\n1;${a}\n25;${b}\n3;${other}\n9;123456.2.0000009-00`;
  const found = cnmsInText(text, cns);
  assert.deepEqual(
    found.map((f) => f.number),
    [1, 25],
  );
});
