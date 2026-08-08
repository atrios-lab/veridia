import assert from "node:assert/strict";
import { test } from "node:test";
import { isPostgresError, UNIQUE_VIOLATION } from "./errors.ts";

// Written after the retry on the protocol counter silently stopped working:
// the code reads the SQLSTATE off the error it caught, and what it catches is
// Drizzle's wrapper, not the driver's error. Under two people submitting at
// once that turned a retry into "não foi possível enviar o pedido".

test("the code is found on the error itself", () => {
  assert.ok(isPostgresError({ code: UNIQUE_VIOLATION }, UNIQUE_VIOLATION));
  assert.equal(isPostgresError({ code: "42P01" }, UNIQUE_VIOLATION), false);
});

test("the code is found through the wrapper that was actually thrown", () => {
  const driverError = Object.assign(new Error("duplicate key"), {
    code: UNIQUE_VIOLATION,
  });
  const wrapped = Object.assign(new Error("Failed query: insert into ..."), {
    cause: driverError,
  });
  assert.ok(isPostgresError(wrapped, UNIQUE_VIOLATION));

  // And through more than one layer of wrapping.
  assert.ok(
    isPostgresError(
      Object.assign(new Error("outer"), { cause: wrapped }),
      UNIQUE_VIOLATION,
    ),
  );
});

test("anything without the code is not the code", () => {
  for (const value of [null, undefined, "23505", new Error("boom"), {}]) {
    assert.equal(isPostgresError(value, UNIQUE_VIOLATION), false);
  }
});

test("a cause that loops back does not hang the request", () => {
  const a: { cause?: unknown } = {};
  const b = { cause: a };
  a.cause = b;
  assert.equal(isPostgresError(a, UNIQUE_VIOLATION), false);
});
