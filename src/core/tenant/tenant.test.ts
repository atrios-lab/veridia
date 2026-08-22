import assert from "node:assert/strict";
import { test } from "node:test";
import {
  enabledSections,
  isSectionEnabled,
  MANDATORY_SECTIONS,
  noticeSectors,
  optionalSections,
} from "./gating.ts";
import {
  isPlatformHost,
  isRegisteredHost,
  normalizeHost,
  resolveTenant,
  TENANTS,
} from "./resolve.ts";
import { parseTenant, type Tenant, THEMES } from "./schema.ts";
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

test("every office declares a theme from the offered set", () => {
  for (const tenant of Object.values(TENANTS)) {
    assert.ok(THEMES.includes(tenant.theme), tenant.slug);
  }
  assert.throws(() => parseTenant({ ...cartorioMarinho, theme: "roxo-neon" }));
});

test("every office has both variants of the seal", () => {
  // The admin login panel is a fixed dark background, regardless of theme:
  // it needs the light variant just as much as the public header needs dark.
  for (const tenant of Object.values(TENANTS)) {
    assert.ok(tenant.logos.seal.light, tenant.slug);
    assert.ok(tenant.logos.seal.dark, tenant.slug);
  }
});

test("the registry exercises more than one theme", () => {
  // A registry where every office looks the same would never catch a colour
  // hardcoded in a component instead of read from the theme.
  const themes = new Set(Object.values(TENANTS).map((t) => t.theme));
  assert.ok(themes.size >= 2);
});

test("the registry is never a single shape", () => {
  const offices = Object.values(TENANTS);
  assert.ok(offices.length >= 2);

  // At least two different attribution sets have to exist: a registry of
  // clones would never catch data leaking between offices. It does not
  // require every office to be unique, because two of them legitimately
  // share a set, and a new office must not have to be exotic to be added.
  const shapes = new Set(offices.map((t) => [...t.attributions].sort().join()));
  assert.ok(shapes.size >= 2);
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

test("only a registered host is recognized as ours", () => {
  assert.ok(isRegisteredHost("cartorioielmomarinhorn.com"));
  assert.ok(isRegisteredHost("WWW.TabelionatoAurora.com.br"));
  assert.ok(isRegisteredHost("aurora.localhost"));
  assert.equal(isRegisteredHost("cartorioielmomarinhorn.com.evil.test"), false);
  assert.equal(isRegisteredHost(""), false);
  assert.equal(isRegisteredHost(undefined), false);
});

test("only platform hosts may fall back to the default office", () => {
  for (const host of [
    "localhost:3000",
    "127.0.0.1:3000",
    "veridia.vercel.app",
  ]) {
    assert.ok(isPlatformHost(host), host);
    assert.equal(
      resolveTenant(host, "tabelionato-aurora").slug,
      "tabelionato-aurora",
      host,
    );
  }
});

test("unknown host is refused instead of served the default office", () => {
  // The leak this guards: an office's host hitting a process that predates
  // its registration (or a typo, or a spoofed Host header) must never get
  // another office's site.
  for (const host of ["quem-sabe.example", "majorsales-typo.localhost"]) {
    assert.equal(isPlatformHost(host), false, host);
    assert.throws(
      () => resolveTenant(host, "tabelionato-aurora"),
      /nao pertence a nenhuma serventia/,
      host,
    );
  }
});

test("missing host with a broken default throws instead of guessing", () => {
  assert.throws(
    () => resolveTenant(undefined, MISSING),
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

test("a mandatory section stays on even when listed as disabled", () => {
  for (const section of MANDATORY_SECTIONS) {
    const overridden: Tenant = {
      ...cartorioMarinho,
      disabledSections: [section],
    };
    assert.ok(isSectionEnabled(overridden, section), section);
  }
});

test("optionalSections never includes a mandatory one", () => {
  for (const tenant of Object.values(TENANTS)) {
    for (const section of optionalSections(tenant)) {
      assert.ok(!MANDATORY_SECTIONS.includes(section), section);
    }
  }
});

test("optionalSections only offers what the attribution grants", () => {
  // NOTAS only: no notice board, so editais must not appear even as an off
  // switch.
  assert.ok(!optionalSections(tabelionatoAurora).includes("editais"));
  assert.ok(optionalSections(cartorioMarinho).includes("editais"));
});
