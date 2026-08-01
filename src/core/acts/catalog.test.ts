import assert from "node:assert/strict";
import { test } from "node:test";
import { ATTRIBUTIONS } from "../tenant/schema.ts";
import { tabelionatoAurora } from "../tenant/tenants/aurora.ts";
import { cartorioMarinho } from "../tenant/tenants/marinho.ts";
import {
  ATTRIBUTION_NAMES,
  actsOfAttribution,
  actsOfTenant,
} from "./catalog.ts";

test("the catalog is filtered by the attributions the office holds", () => {
  const acts = actsOfTenant(tabelionatoAurora);
  assert.ok(acts.length > 0);
  assert.ok(acts.every((a) => a.attribution === "NOTAS"));
  assert.deepEqual(actsOfAttribution(tabelionatoAurora, "RI"), []);
  assert.ok(actsOfTenant(cartorioMarinho).length > acts.length);
});

test("attribution codes stay as the official acronyms", () => {
  assert.deepEqual(
    Object.keys(ATTRIBUTION_NAMES).sort(),
    [...ATTRIBUTIONS].sort(),
  );
});
