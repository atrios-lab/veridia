import assert from "node:assert/strict";
import { test } from "node:test";
import {
  checkFloor,
  floorOf,
  lowestFree,
  NUMBER_SERIES,
  nextSequence,
  parseDocumentNumbering,
  reusesFreedNumbers,
  SERIES_INFO,
} from "./series.ts";

test("o próximo é o maior entre o informado e o último usado mais um", () => {
  assert.equal(nextSequence(0, undefined), 1);
  assert.equal(nextSequence(0, 20), 20);
  assert.equal(nextSequence(25, 20), 26);
  assert.equal(nextSequence(5, undefined), 6);
});

test("número já usado é recusado, com o próximo livre dito", () => {
  assert.equal(checkFloor("guia", 2026, 20, 0), undefined);
  assert.equal(
    checkFloor("guia", 2026, 19, 19),
    "Já foi usado até 019/2026. O próximo precisa ser 020/2026 ou maior.",
  );
  assert.match(checkFloor("REQ", 2026, 0, 0) ?? "", /entre 1 e/);
  assert.match(checkFloor("REQ", 1999, 5, 0) ?? "", /ano/);
});

test("a leitura guardada descarta o que não serve", () => {
  const numbering = parseDocumentNumbering({
    guia: { "2026": 20, "2027": 0, abc: 5 },
    REQ: "nada",
    XYZ: { "2026": 3 },
  });
  assert.deepEqual(numbering, { guia: { "2026": 20 } });
  assert.equal(floorOf(numbering, "guia", 2026), 20);
  assert.equal(floorOf(numbering, "guia", 2027), undefined);
  assert.deepEqual(parseDocumentNumbering(null), {});
});

test("toda numeração do catálogo tem nome e formato", () => {
  for (const series of NUMBER_SERIES) {
    const info = SERIES_INFO[series];
    assert.ok(info.label, series);
    assert.ok(info.format(2026, 1).includes("2026"), series);
  }
  assert.equal(SERIES_INFO.guia.format(2026, 20), "020/2026");
  assert.equal(SERIES_INFO.OUV.format(2026, 7), "OUV.2026.000007");
});

test("a guia excluída deixa o número dela para a próxima", () => {
  assert.equal(lowestFree([], undefined), 1);
  assert.equal(lowestFree([1, 2, 3], undefined), 4);
  assert.equal(lowestFree([1, 3], undefined), 2);
  assert.equal(lowestFree([20, 21], 20), 22);
  assert.equal(lowestFree([20, 22], 20), 21);
  // Below the office's floor is not a vacancy.
  assert.equal(lowestFree([5], 20), 20);
});

test("guias e declarações de ISS reaproveitam número liberado; protocolos não", () => {
  assert.ok(reusesFreedNumbers("guia"));
  assert.ok(reusesFreedNumbers("declaracao-iss"));
  assert.ok(!reusesFreedNumbers("REQ"));
  // 2 was a test, deleted: it may be the next again; 3 is still in use.
  assert.equal(checkFloor("declaracao-iss", 2026, 2, 3, [1, 3]), undefined);
  assert.match(
    checkFloor("declaracao-iss", 2026, 3, 3, [1, 3]) ?? "",
    /003\/2026 já está em uso/,
  );
  assert.equal(lowestFree([1, 3], 1), 2);
});
