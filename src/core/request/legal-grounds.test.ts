import assert from "node:assert/strict";
import { test } from "node:test";
import { ATTRIBUTIONS } from "../tenant/schema.ts";
import {
  citeLegalBasis,
  generalGrounds,
  SPECIALTIES,
} from "./legal-grounds.ts";

test("o fundamento do catálogo sai citado por extenso", () => {
  const cases: [string, string][] = [
    ["Lei 6.015 art. 17", "Lei n. 6.015/1973, art. 17"],
    ["Lei 8.935 art. 7 I", "Lei n. 8.935/1994, art. 7º, I"],
    ["Lei 9.492 arts. 1 e 3", "Lei n. 9.492/1997, arts. 1º e 3º"],
    [
      "Lei 6.015 art. 67 (CC art. 1.525)",
      "Lei n. 6.015/1973, art. 67 (Código Civil, art. 1.525)",
    ],
    [
      "Prov. 149 art. 123 par. 2 e 4",
      "Provimento CNJ n. 149/2023 (Código Nacional de Normas), art. 123, §§ 2º e 4º",
    ],
    [
      "Prov. 149 art. 123 caput; Prov. CGJ/RN 156/2016 arts. 52 e 53",
      "Provimento CNJ n. 149/2023 (Código Nacional de Normas), art. 123, caput; Provimento CGJ/RN n. 156/2016, arts. 52 e 53",
    ],
    [
      "Lei 6.015 art. 30 §1º e §2º; Provimento CGJ/TJRN n. 7/2026",
      "Lei n. 6.015/1973, art. 30, § 1º e § 2º; Provimento CGJ/TJRN n. 7/2026",
    ],
    [
      "Lei 6.015 art. 56 (Lei 14.382/2022)",
      "Lei n. 6.015/1973, art. 56 (Lei n. 14.382/2022)",
    ],
    [
      "CF art. 5º, LXXVI; conferida pela serventia",
      "Constituição Federal, art. 5º, LXXVI; conferida pela serventia",
    ],
  ];
  for (const [catalog, cited] of cases) {
    assert.equal(citeLegalBasis(catalog), cited);
  }
});

test("cada especialidade diz quem a exerce, o que faz e que só age provocada", () => {
  for (const attribution of ATTRIBUTIONS) {
    const specialty = SPECIALTIES[attribution];
    assert.ok(specialty.officer, attribution);
    assert.match(specialty.scope, /Lei n\. \d/, attribution);
    assert.match(specialty.instance, /não (pratica|age)/, attribution);
    assert.match(specialty.instance, /requerimento/, attribution);
    assert.ok(specialty.grounds.length >= 3, attribution);
  }
  // Os registros citam o art. 13 da Lei 6.015; notas e protesto, a sua lei.
  for (const attribution of ["RCPN", "RI", "RTD", "RCPJ"] as const) {
    assert.match(
      SPECIALTIES[attribution].instance,
      /Lei n\. 6\.015\/1973, art\. 13/,
    );
  }
  assert.match(SPECIALTIES.NOTAS.instance, /Lei n\. 8\.935\/1994, art\. 6º, I/);
  assert.match(SPECIALTIES.PROTESTO.instance, /Lei n\. 9\.492\/1997/);
  assert.match(SPECIALTIES.RI.instance, /art\. 217/);
});

test("as normas gerais trazem a Constituição, a Lei 8.935, o CNN e a corregedoria do estado", () => {
  const text = generalGrounds("RN").join("\n");
  assert.match(text, /Constituição Federal, art\. 236/);
  assert.match(text, /Lei n\. 8\.935\/1994, arts\. 1º e 3º/);
  assert.match(text, /Provimento CNJ n\. 149\/2023/);
  assert.match(text, /CGJ\/RN/);
});
