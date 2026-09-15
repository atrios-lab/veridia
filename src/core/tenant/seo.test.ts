import assert from "node:assert/strict";
import { test } from "node:test";
import { TENANTS } from "./resolve.ts";
import {
  jsonLdScript,
  organizationJsonLd,
  PAGE_META,
  postalAddress,
  siteTitle,
  telephone,
} from "./seo.ts";
import { sitemapPaths } from "./site.ts";
import { cartorioMarinho } from "./tenants/marinho.ts";

test("the home title says what the office is, not only what it is called", () => {
  const title = siteTitle(cartorioMarinho);
  assert.ok(title.startsWith(cartorioMarinho.name));
  assert.ok(title.includes(cartorioMarinho.subtitle));
});

test("every page in the sitemap has a title and a description", () => {
  for (const path of sitemapPaths(cartorioMarinho)) {
    const meta = PAGE_META[path];
    assert.ok(meta, `${path} has no PAGE_META entry`);
    // The home takes the office's own title; every other page names itself.
    if (path !== "/") assert.ok(meta.title.length > 0, path);
  }
});

test("descriptions differ per page and fit a search result", () => {
  // The audit found one sentence repeated on all thirteen pages, which is
  // the same as none. Under ~70 characters the snippet looks empty; over
  // ~160 the engine cuts it mid-sentence.
  const seen = new Set<string>();
  for (const [path, meta] of Object.entries(PAGE_META)) {
    const text = meta.description(cartorioMarinho);
    assert.ok(!seen.has(text), `${path} repeats another page's description`);
    seen.add(text);
    assert.ok(
      text.length >= 70 && text.length <= 160,
      `${path}: ${text.length}`,
    );
    assert.ok(
      text.includes(cartorioMarinho.name) ||
        text.includes(cartorioMarinho.subtitle),
      `${path} does not name the office`,
    );
  }
});

test("descriptions read for every registered office", () => {
  for (const tenant of Object.values(TENANTS)) {
    for (const [path, meta] of Object.entries(PAGE_META)) {
      const text = meta.description(tenant);
      assert.ok(text.length >= 70, `${tenant.slug} ${path}`);
      assert.ok(!text.includes("undefined"), `${tenant.slug} ${path}`);
    }
  }
});

test("the address line is split into town, state and CEP", () => {
  assert.deepEqual(
    postalAddress("Rua José Camilo Bezerra, 44, Centro, Ielmo Marinho / RN"),
    {
      "@type": "PostalAddress",
      streetAddress: "Rua José Camilo Bezerra, 44, Centro",
      addressLocality: "Ielmo Marinho",
      addressRegion: "RN",
      addressCountry: "BR",
    },
  );
  assert.deepEqual(
    postalAddress("Praça Padre João Maria, 24, Bom Jesus - RN, 59270-000"),
    {
      "@type": "PostalAddress",
      streetAddress: "Praça Padre João Maria, 24",
      addressLocality: "Bom Jesus",
      addressRegion: "RN",
      postalCode: "59270-000",
      addressCountry: "BR",
    },
  );
  assert.equal(
    postalAddress(
      "Rua Salvina Soares de Miranda, 11-B, Centro, Taipu - RN, 59565-000",
    ).addressLocality,
    "Taipu",
  );
});

test("an address in no known shape is kept whole rather than guessed", () => {
  assert.deepEqual(postalAddress("Centro"), {
    "@type": "PostalAddress",
    streetAddress: "Centro",
    addressCountry: "BR",
  });
});

test("the telephone is the international number", () => {
  assert.equal(telephone("(84) 4042-0940"), "+558440420940");
  assert.equal(telephone("+55 84 4042-0940"), "+558440420940");
});

test("the office's JSON-LD carries what a search engine matches on", () => {
  const origin = "https://www.cartorioielmomarinhorn.com";
  const data = organizationJsonLd(cartorioMarinho, origin);
  assert.equal(data.url, origin);
  assert.equal(data.name, cartorioMarinho.name);
  assert.equal(data.telephone, "+558440420940");
  assert.equal(data.email, cartorioMarinho.contacts.email);
  assert.equal(
    (data.address as Record<string, string>).addressLocality,
    "Ielmo Marinho",
  );
  const [hours] = data.openingHoursSpecification as Record<string, unknown>[];
  assert.equal(hours.opens, "08:00");
  assert.equal(hours.closes, "14:00");
  assert.equal((data.identifier as Record<string, string>).value, "094615");
  assert.ok((data.logo as string).startsWith(`${origin}/`));
});

test("an office without an address or hero image omits them", () => {
  const data = organizationJsonLd(
    { ...cartorioMarinho, address: undefined, heroImage: undefined },
    "https://exemplo.com",
  );
  assert.ok(!("address" in data));
  assert.ok(!("image" in data));
});

test("the script text cannot close its own tag", () => {
  const text = jsonLdScript({ name: "</script><script>alert(1)" });
  assert.ok(!text.includes("</script>"));
  assert.equal(JSON.parse(text).name, "</script><script>alert(1)");
});
