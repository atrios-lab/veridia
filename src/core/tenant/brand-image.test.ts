import assert from "node:assert/strict";
import { test } from "node:test";
import { brandImageUrl, checkBrandImage } from "./brand-image.ts";

test("a small PNG logo passes", () => {
  assert.equal(
    checkBrandImage("logo-light", { mimeType: "image/png", size: 300_000 }),
    undefined,
  );
});

test("a type outside the allowlist is rejected", () => {
  const problem = checkBrandImage("logo-light", {
    mimeType: "image/svg+xml",
    size: 1000,
  });
  assert.deepEqual(problem, { kind: "type", mimeType: "image/svg+xml" });
});

test("a logo over 1 MB is rejected", () => {
  const problem = checkBrandImage("logo-dark", {
    mimeType: "image/jpeg",
    size: 1024 * 1024 + 1,
  });
  assert.deepEqual(problem, { kind: "size", limit: 1024 * 1024 });
});

test("a hero photo may be up to 4 MB, unlike a logo", () => {
  const size = 2 * 1024 * 1024;
  assert.deepEqual(
    checkBrandImage("logo-light", { mimeType: "image/webp", size }),
    { kind: "size", limit: 1024 * 1024 },
  );
  assert.equal(
    checkBrandImage("hero", { mimeType: "image/webp", size }),
    undefined,
  );
  assert.deepEqual(
    checkBrandImage("hero", {
      mimeType: "image/webp",
      size: 4 * 1024 * 1024 + 1,
    }),
    { kind: "size", limit: 4 * 1024 * 1024 },
  );
});

test("the seal carries the logotype's 1 MB limit, not the hero's", () => {
  const size = 2 * 1024 * 1024;
  assert.deepEqual(
    checkBrandImage("seal-light", { mimeType: "image/png", size }),
    { kind: "size", limit: 1024 * 1024 },
  );
  assert.equal(
    checkBrandImage("seal-dark", { mimeType: "image/png", size: 300_000 }),
    undefined,
  );
});

test("an uploaded seal keeps its own absolute URL, a shipped one gets the host", () => {
  const blob = "https://store.public.blob.vercel-storage.com/marca/a/b.png";
  assert.equal(brandImageUrl(blob, "www.cartorio.com.br"), blob);
  assert.equal(
    brandImageUrl("/logos/CM-Sublogo-preto.png", "www.cartorio.com.br"),
    "https://www.cartorio.com.br/logos/CM-Sublogo-preto.png",
  );
  // No host registered: no seal, rather than a link to nowhere.
  assert.equal(brandImageUrl("/logos/CM-Sublogo-preto.png", undefined), "");
});
