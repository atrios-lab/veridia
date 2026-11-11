import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCsp, isFramablePdfPath } from "./csp.ts";

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
    "'self' https://vercel.com https://store.example.test http://127.0.0.1:47820",
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

test("frames are refused by default and object-src stays closed", () => {
  const csp = buildCsp(BASE);
  assert.equal(directive(csp, "frame-ancestors"), "'none'");
  assert.equal(directive(csp, "object-src"), "'none'");
});

test("a framable response accepts its own origin only, object-src unchanged", () => {
  const csp = buildCsp({ ...BASE, frameAncestors: "self" });
  assert.equal(directive(csp, "frame-ancestors"), "'self'");
  assert.equal(directive(csp, "object-src"), "'none'");
});

test("only the two public transparency PDFs are framable", () => {
  assert.equal(isFramablePdfPath("/transparencia/documento/abc-123"), true);
  assert.equal(isFramablePdfPath("/transparencia/boletim/abc-123"), true);

  assert.equal(isFramablePdfPath("/transparencia"), false);
  assert.equal(isFramablePdfPath("/transparencia/documentos"), false);
  assert.equal(isFramablePdfPath("/transparencia/documento/"), false);
  assert.equal(isFramablePdfPath("/transparencia/boletim/abc/extra"), false);
  assert.equal(isFramablePdfPath("/admin/transparencia/documento"), false);
  assert.equal(isFramablePdfPath("/solicitar"), false);
});
