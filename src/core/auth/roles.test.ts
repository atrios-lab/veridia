import assert from "node:assert/strict";
import { test } from "node:test";
import { can, isRole } from "./roles.ts";

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
