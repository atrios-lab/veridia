import assert from "node:assert/strict";
import { test } from "node:test";
import { foldText, type OfficeEntry, searchOffices } from "./offices.ts";
import { RN_OFFICES } from "./rn-offices.ts";

const SAMPLE: OfficeEntry[] = [
  { cns: "094441", name: "OFÍCIO ÚNICO DE ACARI", city: "Acari/RN" },
  { cns: "000001", name: "1º OFÍCIO DE APODI", city: "Apodi/RN" },
  { cns: "000002", name: "2º OFÍCIO DE APODI", city: "Apodi/RN" },
  { cns: "000003", name: "OFÍCIO ÚNICO DE ITAÚ", city: "Itaú/RN" },
  {
    cns: "000004",
    name: "OFÍCIO ÚNICO DE DOUTOR SEVERIANO",
    city: "Doutor Severiano/RN",
  },
];

test("accents and case do not matter", () => {
  assert.equal(foldText("Itaú"), foldText("ITAU"));
  assert.deepEqual(
    searchOffices(SAMPLE, "itau").map((o) => o.cns),
    ["000003"],
  );
});

test("every word must match, in the name, the city or the CNS", () => {
  assert.deepEqual(
    searchOffices(SAMPLE, "2º apodi").map((o) => o.cns),
    ["000002"],
  );
  assert.deepEqual(
    searchOffices(SAMPLE, "094441").map((o) => o.name),
    ["OFÍCIO ÚNICO DE ACARI"],
  );
});

test("a municipality that starts with what was typed comes first", () => {
  const found = searchOffices(SAMPLE, "sever").map((o) => o.cns);
  assert.deepEqual(found, ["000004"]);
  assert.deepEqual(
    searchOffices(SAMPLE, "apodi").map((o) => o.cns),
    ["000001", "000002"],
  );
});

test("one letter opens nothing", () => {
  assert.deepEqual(searchOffices(SAMPLE, "a"), []);
  assert.deepEqual(searchOffices(SAMPLE, "  "), []);
});

test("the RN list has one entry per CNS, each with a name and a city in RN", () => {
  const seen = new Set<string>();
  assert.ok(RN_OFFICES.length > 200);
  for (const office of RN_OFFICES) {
    assert.match(office.cns, /^\d{6}$/, office.name);
    assert.ok(!seen.has(office.cns), `CNS repetido: ${office.cns}`);
    seen.add(office.cns);
    assert.ok(office.name.trim(), office.cns);
    assert.match(office.city, /\/RN$/, office.cns);
  }
});

test("the offices of the cohorts created on 16/11/2026 are in the list", () => {
  for (const query of [
    "severiano melo",
    "carnaubais",
    "itau",
    "1º apodi",
    "2º apodi",
    "equador",
  ]) {
    assert.ok(searchOffices(RN_OFFICES, query).length > 0, query);
  }
});

test("the list carries the correction of the source's misspelt name", () => {
  const office = RN_OFFICES.find((o) => o.cns === "095034");
  assert.equal(office?.name, "Ofício Único de Fernando Pedroza");
  assert.ok(!RN_OFFICES.some((o) => /\bFe ando\b/.test(o.name)));
});

test("no telephone in the list is shorter than a real one", () => {
  for (const office of RN_OFFICES) {
    if (!office.contactPhone) continue;
    assert.ok(
      office.contactPhone.replace(/\D/g, "").length >= 10,
      `${office.cns}: ${office.contactPhone}`,
    );
  }
});
