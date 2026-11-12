import assert from "node:assert/strict";
import { test } from "node:test";
import { PAGE_META, siteTitle } from "@/core/tenant/seo.ts";
import { cartorioMarinho } from "@/core/tenant/tenants/marinho.ts";
import { rootMetadata } from "./root-metadata.ts";

const ORIGIN = "https://cartoriomarinho.com.br";

test("the root metadata carries the office's title, seal and canonical", () => {
  const metadata = rootMetadata(cartorioMarinho, ORIGIN);
  assert.deepEqual(metadata.title, {
    default: siteTitle(cartorioMarinho),
    template: `%s | ${cartorioMarinho.name}`,
  });
  assert.equal(
    metadata.description,
    PAGE_META["/"].description(cartorioMarinho),
  );
  assert.deepEqual(metadata.icons, { icon: cartorioMarinho.logos.seal.light });
  assert.deepEqual(metadata.alternates, { canonical: "./" });
  assert.equal(String(metadata.metadataBase), `${ORIGIN}/`);
});

test("the root metadata carries the home's social card", () => {
  const metadata = rootMetadata(cartorioMarinho, ORIGIN);
  assert.ok(metadata.openGraph, "openGraph");
  assert.ok(metadata.twitter, "twitter");
});
