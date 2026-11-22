import assert from "node:assert/strict";
import { test } from "node:test";
import { SECTION_ROUTES } from "./gating.ts";
import type { Tenant } from "./schema.ts";
import {
  linkedSections,
  newsSitemapEntries,
  ROBOTS_DISALLOW,
  sitemapPaths,
  siteOrigin,
} from "./site.ts";
import { tabelionatoAurora } from "./tenants/aurora.ts";
import { cartorioMarinho } from "./tenants/marinho.ts";

// An office with someone on its team page and a post on its board.
const EVERYTHING = { hasTeam: true, hasNews: true };

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
  const paths = sitemapPaths(cartorioMarinho, EVERYTHING);
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
  const paths = sitemapPaths(notasOnly, EVERYTHING);
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
  assert.ok(
    !sitemapPaths(withoutSelo, EVERYTHING).includes(
      SECTION_ROUTES["selo-tjrn"],
    ),
  );
});

test("nothing in the sitemap is disallowed to crawlers", () => {
  // A path both listed and blocked would be a contradiction the search
  // engine resolves by ignoring the sitemap entry. Prefix match, like a
  // crawler does.
  for (const path of sitemapPaths(cartorioMarinho, EVERYTHING)) {
    for (const prefix of ROBOTS_DISALLOW) {
      assert.ok(!path.startsWith(prefix), `${path} vs ${prefix}`);
    }
  }
});

test("an empty team page and an empty board leave the sitemap and the menus", () => {
  // No link reaches them, so a search engine only files them as discovered;
  // listing them made 27 of the sitemaps' 210 addresses empty pages.
  const nothing = { hasTeam: false, hasNews: false };
  const paths = sitemapPaths(cartorioMarinho, nothing);
  assert.ok(!paths.includes(SECTION_ROUTES.equipe));
  assert.ok(!paths.includes(SECTION_ROUTES.noticias));
  const sections = linkedSections(cartorioMarinho, nothing);
  assert.ok(!sections.includes("equipe"));
  assert.ok(!sections.includes("noticias"));
  // Everything else the office offers stays.
  assert.ok(paths.includes("/"));
  assert.ok(paths.includes("/contato"));
});

test("each page joins once something is published on it", () => {
  const teamOnly = sitemapPaths(cartorioMarinho, {
    hasTeam: true,
    hasNews: false,
  });
  assert.ok(teamOnly.includes(SECTION_ROUTES.equipe));
  assert.ok(!teamOnly.includes(SECTION_ROUTES.noticias));
  const newsOnly = sitemapPaths(cartorioMarinho, {
    hasTeam: false,
    hasNews: true,
  });
  assert.ok(!newsOnly.includes(SECTION_ROUTES.equipe));
  assert.ok(newsOnly.includes(SECTION_ROUTES.noticias));
});

test("a section the office switched off stays out even with content", () => {
  const withoutTeam: Tenant = {
    ...cartorioMarinho,
    disabledSections: ["equipe"],
  };
  assert.ok(
    !sitemapPaths(withoutTeam, EVERYTHING).includes(SECTION_ROUTES.equipe),
  );
});

test("each published post is listed with the day it went to the site", () => {
  const id = "0b9f3c3e-8d1a-4f55-9a0e-2a7d1c5e9f10";
  assert.deepEqual(
    newsSitemapEntries([{ id, publishedAt: "2026-11-14T13:05:00.000Z" }]),
    [{ path: `/noticias/${id}`, lastModified: "2026-11-14" }],
  );
  // No date is better than a made-up one.
  assert.deepEqual(newsSitemapEntries([{ id, publishedAt: null }]), [
    { path: `/noticias/${id}` },
  ]);
  assert.deepEqual(newsSitemapEntries([]), []);
});
