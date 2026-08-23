import assert from "node:assert/strict";
import { test } from "node:test";
import { requestHost } from "./request-host.ts";

test("the forwarded host wins over the server's own", () => {
  // What Next sends when it re-renders the destination of a Server Action's
  // redirect: its own address in `host`, the office's domain forwarded. Read
  // the wrong one and every office resolves to the DEFAULT_TENANT one.
  const headers = new Headers({
    host: "localhost:3000",
    "x-forwarded-host": "taipu.localhost:3000",
  });
  assert.equal(requestHost(headers), "taipu.localhost:3000");
});

test("an ordinary request has only the host header", () => {
  assert.equal(
    requestHost(new Headers({ host: "cartoriotaipurn.com" })),
    "cartoriotaipurn.com",
  );
});

test("no host header at all is undefined, never a guess", () => {
  assert.equal(requestHost(new Headers()), undefined);
});
