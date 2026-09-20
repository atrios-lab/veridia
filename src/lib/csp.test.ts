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
};

test("without a store, media-src is 'self' and the local blob: scheme", () => {
  assert.equal(directive(buildCsp(BASE), "media-src"), "'self' blob:");
});

test("the store host reaches img-src, media-src and connect-src, exact and once", () => {
  const csp = buildCsp({ ...BASE, blobPublicHost: "store.example.test" });
  assert.equal(
    directive(csp, "img-src"),
    "'self' data: blob: https://store.example.test",
  );
  assert.equal(
    directive(csp, "media-src"),
    "'self' blob: https://store.example.test",
  );
  assert.equal(
    directive(csp, "connect-src"),
    "'self' https://vercel.com https://store.example.test",
  );
  assert.ok(!csp.includes("*"));
});

test("the nonce lands in script-src, and unsafe-eval only in development", () => {
  assert.equal(directive(buildCsp(BASE), "script-src"), "'self' 'nonce-abc'");
  assert.equal(
    directive(buildCsp({ ...BASE, isDev: true }), "script-src"),
    "'self' 'nonce-abc' 'unsafe-eval'",
  );
});
