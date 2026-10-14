import assert from "node:assert/strict";
import { test } from "node:test";
import { describeTjFailure } from "./failure.ts";

test("a refused session keeps the status and the region", () => {
  assert.deepEqual(describeTjFailure("session", { status: 403 }, "gru1"), {
    step: "session",
    status: 403,
    reason: "http",
    region: "gru1",
  });
});

test("a 200 without JSESSIONID is told apart from a refusal", () => {
  assert.deepEqual(describeTjFailure("session", { missingSession: true }), {
    step: "session",
    reason: "no-session",
  });
});

test("a timeout is named as such, with no status", () => {
  const error = new DOMException("The operation timed out.", "TimeoutError");
  assert.deepEqual(describeTjFailure("captcha", { error }, "iad1"), {
    step: "captcha",
    reason: "timeout",
    region: "iad1",
  });
});

test("a network error is described by its code", () => {
  const error = new TypeError("fetch failed", {
    cause: Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" }),
  });
  assert.deepEqual(describeTjFailure("lookup", { error }), {
    step: "lookup",
    reason: "TypeError:ECONNRESET",
  });
});

test("nothing the citizen sent reaches the record, even inside the error", () => {
  const session = "_qJ2_ARxEW4G9nbZgxy0CS53AMyXj.jodi-petkoff";
  const code = "RN20260000000000000000";
  const captcha = "x7k2p";
  const error = new Error(
    `POST siexnet JSESSIONID=${session} codigo=${code} captcha=${captcha}`,
  );

  const record = JSON.stringify(describeTjFailure("lookup", { error }));

  for (const secret of [session, code, captcha]) {
    assert.ok(!record.includes(secret), `${secret} leaked into ${record}`);
  }
});
