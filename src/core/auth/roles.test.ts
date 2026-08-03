import assert from "node:assert/strict";
import { test } from "node:test";
import { can, canAccessTenant, isRole } from "./roles.ts";

const MARINHO = "cartorio-marinho";
const AURORA = "tabelionato-aurora";

test("admin may publish and manage users", () => {
  assert.ok(can("admin", "content.publish"));
  assert.ok(can("admin", "user.manage"));
});

test("staff may edit but not publish or manage users", () => {
  assert.ok(can("staff", "content.edit"));
  assert.equal(can("staff", "content.publish"), false);
  assert.equal(can("staff", "user.manage"), false);
});

test("an unknown role gets nothing", () => {
  assert.equal(isRole("superuser"), false);
  assert.equal(can("superuser", "admin.access"), false);
  assert.equal(can("", "admin.access"), false);
});

test("a user acts on their own office", () => {
  assert.ok(canAccessTenant(MARINHO, MARINHO));
  assert.ok(canAccessTenant(AURORA, AURORA));
});

test("a user does not act on another office", () => {
  assert.equal(canAccessTenant(AURORA, MARINHO), false);
  assert.equal(canAccessTenant(MARINHO, AURORA), false);
});

test("being an admin does not widen the scope", () => {
  // The role grants every permission there is, and still no access next door.
  assert.ok(can("admin", "user.manage"));
  assert.equal(canAccessTenant(AURORA, MARINHO), false);
});

test("the right office without the role is not enough", () => {
  assert.ok(canAccessTenant(MARINHO, MARINHO));
  assert.equal(can("visitante", "admin.access"), false);
});

test("an empty or orphan office slug authorizes nothing", () => {
  assert.equal(canAccessTenant("", ""), false);
  assert.equal(canAccessTenant("", MARINHO), false);
  assert.equal(
    canAccessTenant("serventia-que-saiu-do-registro", MARINHO),
    false,
  );
  // Same slug on both sides is still refused when the office is not registered.
  assert.equal(
    canAccessTenant("serventia-que-saiu", "serventia-que-saiu"),
    false,
  );
});

test("a prototype property is not an office", () => {
  // "constructor" in TENANTS is true; Object.hasOwn is what makes it false.
  assert.equal(canAccessTenant("constructor", "constructor"), false);
  assert.equal(canAccessTenant("toString", "toString"), false);
});
