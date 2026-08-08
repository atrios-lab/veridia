import assert from "node:assert/strict";
import { test } from "node:test";
import { CreateAccountSchema } from "./account.ts";

test("accepts a valid name, e-mail and role", () => {
  const parsed = CreateAccountSchema.safeParse({
    name: "Júlia Santos",
    email: "julia.santos@exemplo.com",
    role: "staff",
  });
  assert.ok(parsed.success);
});

test("rejects an empty name, an invalid e-mail, and an unknown role", () => {
  assert.equal(
    CreateAccountSchema.safeParse({
      name: "",
      email: "julia@exemplo.com",
      role: "staff",
    }).success,
    false,
  );
  assert.equal(
    CreateAccountSchema.safeParse({
      name: "Júlia Santos",
      email: "não é um e-mail",
      role: "staff",
    }).success,
    false,
  );
  assert.equal(
    CreateAccountSchema.safeParse({
      name: "Júlia Santos",
      email: "julia@exemplo.com",
      role: "superadmin",
    }).success,
    false,
  );
});

test("has no password field to forge", () => {
  const parsed = CreateAccountSchema.safeParse({
    name: "Júlia Santos",
    email: "julia@exemplo.com",
    role: "staff",
    password: "seria-ignorada",
  });
  assert.ok(parsed.success);
  assert.equal((parsed.data as Record<string, unknown>).password, undefined);
});
