import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { splitPlaceTail } from "./place-tail.ts";
import { TENANTS } from "./resolve.ts";

describe("splitPlaceTail", () => {
  it("keeps the town's last word with the state", () => {
    assert.deepEqual(splitPlaceTail("Ofício Único de Cruzeta / RN"), {
      head: "Ofício Único de ",
      tail: "Cruzeta / RN",
    });
  });

  it("joins only the last word of a long town name", () => {
    assert.deepEqual(
      splitPlaceTail("2º Ofício de Notas de São José de Mipibu / RN"),
      { head: "2º Ofício de Notas de São José de ", tail: "Mipibu / RN" },
    );
  });

  it("accepts the state written without spaces or with a hyphen", () => {
    assert.equal(splitPlaceTail("Cartório de Cruzeta/RN").tail, "Cruzeta/RN");
    assert.equal(
      splitPlaceTail("Cartório de Cruzeta - RN").tail,
      "Cruzeta - RN",
    );
    assert.equal(splitPlaceTail("Cartório de Cruzeta-RN").tail, "Cruzeta-RN");
  });

  it("leaves a name without the state as it is", () => {
    assert.deepEqual(splitPlaceTail("Cartório de Cruzeta"), {
      head: "Cartório de Cruzeta",
      tail: "",
    });
    assert.deepEqual(splitPlaceTail(""), { head: "", tail: "" });
  });

  it("finds the place in the title and subtitle of every office", () => {
    for (const tenant of Object.values(TENANTS)) {
      for (const text of [tenant.home.title, tenant.subtitle]) {
        const { head, tail } = splitPlaceTail(text);
        assert.match(tail, /\S \/ [A-Z]{2}$/, `${tenant.slug}: ${text}`);
        assert.equal(head + tail, text.trimEnd());
      }
    }
  });
});
