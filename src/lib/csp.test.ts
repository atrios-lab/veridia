import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCsp } from "./csp.ts";

function directive(csp: string, name: string): string | undefined {
  return csp
    .split("; ")
    .find((d) => d.startsWith(`${name} `))
    ?.slice(name.length + 1);
}

const BASE = {
  nonce: "abc",
  isDev: false,
  blobPublicHost: undefined,
  mediaHosts: [],
};

test("with no tutorial in the catalog, media-src is 'self' and nothing else", () => {
  assert.equal(directive(buildCsp(BASE), "media-src"), "'self'");
});

test("each media host is listed once, as an exact https origin", () => {
  const csp = buildCsp({
    ...BASE,
    mediaHosts: ["abc123.public.blob.vercel-storage.com"],
  });
  assert.equal(
    directive(csp, "media-src"),
    "'self' https://abc123.public.blob.vercel-storage.com",
  );
  assert.ok(!csp.includes("*"));
});

test("the Blob store host reaches img-src and connect-src, not media-src", () => {
  const csp = buildCsp({ ...BASE, blobPublicHost: "store.example.test" });
  assert.equal(
    directive(csp, "img-src"),
    "'self' data: blob: https://store.example.test",
  );
  assert.equal(
    directive(csp, "connect-src"),
    "'self' https://vercel.com https://store.example.test",
  );
  assert.equal(directive(csp, "media-src"), "'self'");
});

test("the nonce lands in script-src, and unsafe-eval only in development", () => {
  assert.equal(directive(buildCsp(BASE), "script-src"), "'self' 'nonce-abc'");
  assert.equal(
    directive(buildCsp({ ...BASE, isDev: true }), "script-src"),
    "'self' 'nonce-abc' 'unsafe-eval'",
  );
});
