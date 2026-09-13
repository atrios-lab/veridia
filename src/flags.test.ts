import assert from "node:assert/strict";
import { test } from "node:test";
import { encryptOverrides } from "flags";
import { trackingHref } from "./flags.ts";

// Migrated from e2e/citizen-tracking-flag.spec.ts: what those tests proved
// by loading pages in a browser and reading cookie overrides is the same
// decision `trackingHref` makes, called here directly with a `Request`
// carrying the override cookie `flags` itself expects (see `FlagRequest` in
// the `flags` package). No page, no cookie jar, no Chromium.

process.env.FLAGS_SECRET ??= "bFYACh3M3kODLC3hySGxgS5TJSL_fNME2gXNehI_IOc";

function requestWithOverrideCookie(cookieValue: string): Request {
  return new Request("https://marinho.exemplo.com/", {
    headers: { cookie: `vercel-flag-overrides=${cookieValue}` },
  });
}

test("no override, and no request at all, resolves to /protocolo", async () => {
  assert.equal(await trackingHref(), "/protocolo");
});

test("an override cookie that turns the flag on resolves to /acompanhar", async () => {
  const cookieValue = await encryptOverrides({ "citizen-tracking-v2": true });
  const href = await trackingHref(requestWithOverrideCookie(cookieValue));
  assert.equal(href, "/acompanhar");
});

test("an override cookie encrypted with a different secret is ignored, not thrown", async () => {
  const cookieValue = await encryptOverrides(
    { "citizen-tracking-v2": true },
    "QEdoyLy6GcbApmy58vAMK4OpoaEyCSQM1RpSeRWMZjo",
  );
  const href = await trackingHref(requestWithOverrideCookie(cookieValue));
  assert.equal(href, "/protocolo");
});

test("a request with no override cookie at all resolves to the default", async () => {
  const href = await trackingHref(new Request("https://marinho.exemplo.com/"));
  assert.equal(href, "/protocolo");
});
