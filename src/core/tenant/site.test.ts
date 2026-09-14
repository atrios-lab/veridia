import assert from "node:assert/strict";
import { test } from "node:test";
import { SECTION_ROUTES } from "./gating.ts";
import type { Tenant } from "./schema.ts";
import { ROBOTS_DISALLOW, sitemapPaths, siteOrigin } from "./site.ts";
import { tabelionatoAurora } from "./tenants/aurora.ts";
import { cartorioMarinho } from "./tenants/marinho.ts";

test("a public domain is declared over https, exactly as requested", () => {
  // "www" or not is the edge's decision, not ours: the host arrives already
  // in its final spelling and is kept as is.
  assert.equal(
    siteOrigin("www.cartorioielmomarinhorn.com"),
    "https://www.cartorioielmomarinhorn.com",
  );
  assert.equal(
    siteOrigin("1cartoriomacaibarn.com.br"),
    "https://1cartoriomacaibarn.com.br",
  );
  assert.equal(siteOrigin("WWW.Exemplo.com"), "https://www.exemplo.com");
});

test("development hosts are plain http and keep their port", () => {
  assert.equal(siteOrigin("localhost:3000"), "http://localhost:3000");
  assert.equal(
    siteOrigin("marinho.localhost:3000"),
    "http://marinho.localhost:3000",
  );
  assert.equal(siteOrigin("127.0.0.1"), "http://127.0.0.1");
});

test("the sitemap lists every page of an office with all attributions", () => {
  const paths = sitemapPaths(cartorioMarinho);
  for (const route of Object.values(SECTION_ROUTES)) {
    assert.ok(paths.includes(route), route);
  }
  // The contact page is the second page of the "centrais-contato" section.
  assert.ok(paths.includes("/contato"));
  assert.ok(paths.includes("/plataforma"));
  assert.ok(paths.includes("/privacidade"));
  assert.equal(new Set(paths).size, paths.length, "no path twice");
  assert.equal(paths[0], "/", "the home comes first");
});

test("the sitemap skips what the office does not offer", () => {
  // NOTAS alone has no notice board and no protocol lookup.
  const notasOnly: Tenant = { ...tabelionatoAurora, attributions: ["NOTAS"] };
  const paths = sitemapPaths(notasOnly);
  assert.ok(!paths.includes(SECTION_ROUTES.editais));
  assert.ok(!paths.includes(SECTION_ROUTES["consulta-protocolo"]));
  // Mandatory sections stay, whatever the attributions.
  assert.ok(paths.includes("/"));
  assert.ok(paths.includes(SECTION_ROUTES["dpo-lgpd"]));
  assert.ok(paths.includes(SECTION_ROUTES.transparencia));
});

test("a section switched off by the office leaves the sitemap", () => {
  const withoutSelo: Tenant = {
    ...cartorioMarinho,
    disabledSections: ["selo-tjrn"],
  };
  assert.ok(!sitemapPaths(withoutSelo).includes(SECTION_ROUTES["selo-tjrn"]));
});

test("nothing in the sitemap is disallowed to crawlers", () => {
  // A path both listed and blocked would be a contradiction the search
  // engine resolves by ignoring the sitemap entry. Prefix match, like a
  // crawler does, minus the query-only rules.
  const prefixes = ROBOTS_DISALLOW.filter((rule) => !rule.includes("?"));
  for (const path of sitemapPaths(cartorioMarinho)) {
    for (const prefix of prefixes) {
      assert.ok(!path.startsWith(prefix), `${path} vs ${prefix}`);
    }
  }
});
