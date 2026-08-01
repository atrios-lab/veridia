import assert from "node:assert/strict";
import { test } from "node:test";
import { enabledSections, isSectionEnabled, noticeSectors } from "./gating.ts";
import { normalizeHost, resolveTenant, TENANTS } from "./resolve.ts";
import { parseTenant, type Tenant } from "./schema.ts";
import { tabelionatoAurora } from "./tenants/aurora.ts";
import { cartorioMarinho } from "./tenants/marinho.ts";

// Every host lookup below passes a slug that is not in the registry, so a
// passing test cannot be the fallback answering by accident.
const MISSING = "__no-such-office__";

test("valid config is accepted and typed", () => {
  const tenant = parseTenant({ ...cartorioMarinho });
  assert.equal(tenant.slug, "cartorio-marinho");
  assert.equal(tenant.issRate, 0.05);
});

test("config missing a required field is rejected", () => {
  const { cns: _cns, ...withoutCns } = cartorioMarinho;
  assert.throws(() => parseTenant(withoutCns));
});

test("registry holds at least two offices with different attributions", () => {
  const offices = Object.values(TENANTS);
  assert.ok(offices.length >= 2);
  const shapes = new Set(offices.map((t) => [...t.attributions].sort().join()));
  assert.equal(shapes.size, offices.length);
});

test("mapped host resolves the office", () => {
  assert.equal(
    resolveTenant("cartorioielmomarinhorn.com", MISSING).slug,
    "cartorio-marinho",
  );
  assert.equal(
    resolveTenant("tabelionatoaurora.com.br", MISSING).slug,
    "tabelionato-aurora",
  );
});

test("host resolves through case, port and www", () => {
  for (const host of [
    "CartorioIelmoMarinhoRN.com",
    "www.cartorioielmomarinhorn.com",
    "cartorioielmomarinhorn.com:3000",
    "WWW.CartorioIelmoMarinhoRN.com:443",
  ]) {
    assert.equal(resolveTenant(host, MISSING).slug, "cartorio-marinho", host);
  }
  assert.equal(normalizeHost("WWW.Example.COM:8080"), "example.com");
});

test("unknown host falls back to the default office", () => {
  assert.equal(
    resolveTenant("quem-sabe.example", "tabelionato-aurora").slug,
    "tabelionato-aurora",
  );
});

test("unknown host with a broken default throws instead of guessing", () => {
  assert.throws(
    () => resolveTenant("quem-sabe.example", MISSING),
    /Serventia nao encontrada/,
  );
});

test("attribution turns the notices section on, with proclamas", () => {
  assert.ok(isSectionEnabled(cartorioMarinho, "editais"));
  assert.ok(noticeSectors(cartorioMarinho).includes("proclamas"));
});

test("an office with NOTAS only has no notices section", () => {
  assert.equal(tabelionatoAurora.attributions.join(), "NOTAS");
  assert.equal(isSectionEnabled(tabelionatoAurora, "editais"), false);
  assert.deepEqual(noticeSectors(tabelionatoAurora), []);
  assert.ok(!enabledSections(tabelionatoAurora).includes("editais"));
});

test("institutional sections stay on regardless of attributions", () => {
  for (const tenant of Object.values(TENANTS)) {
    for (const section of [
      "inicio",
      "ouvidoria",
      "transparencia",
      "dpo-lgpd",
      "selo-tjrn",
      "centrais-contato",
    ] as const) {
      assert.ok(isSectionEnabled(tenant, section), `${tenant.slug}/${section}`);
    }
  }
});

test("override disables a section the attribution would grant", () => {
  const granted: Tenant = { ...cartorioMarinho, disabledSections: [] };
  assert.ok(isSectionEnabled(granted, "consulta-protocolo"));

  const overridden: Tenant = {
    ...cartorioMarinho,
    disabledSections: ["consulta-protocolo"],
  };
  assert.equal(isSectionEnabled(overridden, "consulta-protocolo"), false);
});

test("override never enables a section the attributions do not grant", () => {
  const forced: Tenant = { ...tabelionatoAurora, disabledSections: [] };
  assert.equal(isSectionEnabled(forced, "editais"), false);
});
