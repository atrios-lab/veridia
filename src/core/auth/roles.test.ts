import assert from "node:assert/strict";
import { test } from "node:test";
import { isRegisteredSlug } from "../tenant/resolve.ts";
import {
  can,
  canAccessTenant,
  isAccountDisabled,
  isLastActiveAdmin,
  isRole,
  SUPERADMIN_TENANT_SLUG,
} from "./roles.ts";

const MARINHO = "cartorio-marinho";
const AURORA = "tabelionato-aurora";

test("admin may publish and manage users", () => {
  assert.ok(can("admin", "content.publish"));
  assert.ok(can("admin", "user.manage"));
});

test("staff may edit but not publish, bill or manage users", () => {
  assert.ok(can("staff", "content.edit"));
  assert.equal(can("staff", "content.publish"), false);
  assert.equal(can("staff", "billing.edit"), false);
  assert.equal(can("staff", "user.manage"), false);
});

test("admin may edit billing", () => {
  assert.ok(can("admin", "billing.edit"));
});

test("staff may manage chat conversations but not the office's chat switch", () => {
  assert.ok(can("staff", "chat.manage"));
  assert.equal(can("staff", "chat.settings"), false);
});

test("admin may manage chat conversations and the office's chat switch", () => {
  assert.ok(can("admin", "chat.manage"));
  assert.ok(can("admin", "chat.settings"));
});

test("an unknown role gets nothing", () => {
  assert.equal(isRole("superuser"), false);
  assert.equal(can("superuser", "admin.access"), false);
  assert.equal(can("", "admin.access"), false);
});

test("a user acts on their own office", () => {
  assert.ok(canAccessTenant("admin", MARINHO, MARINHO));
  assert.ok(canAccessTenant("staff", AURORA, AURORA));
});

test("a user does not act on another office", () => {
  assert.equal(canAccessTenant("admin", AURORA, MARINHO), false);
  assert.equal(canAccessTenant("staff", MARINHO, AURORA), false);
});

test("being an admin does not widen the scope", () => {
  // The role grants every permission there is, and still no access next door.
  assert.ok(can("admin", "user.manage"));
  assert.equal(canAccessTenant("admin", AURORA, MARINHO), false);
});

test("the right office without the role is not enough", () => {
  assert.ok(canAccessTenant("admin", MARINHO, MARINHO));
  assert.equal(can("visitante", "admin.access"), false);
});

test("an empty or orphan office slug authorizes nothing", () => {
  assert.equal(canAccessTenant("admin", "", ""), false);
  assert.equal(canAccessTenant("admin", "", MARINHO), false);
  assert.equal(
    canAccessTenant("admin", "serventia-que-saiu-do-registro", MARINHO),
    false,
  );
  // Same slug on both sides is still refused when the office is not registered.
  assert.equal(
    canAccessTenant("admin", "serventia-que-saiu", "serventia-que-saiu"),
    false,
  );
});

test("a prototype property is not an office", () => {
  // "constructor" in TENANTS is true; Object.hasOwn is what makes it false.
  assert.equal(canAccessTenant("admin", "constructor", "constructor"), false);
  assert.equal(canAccessTenant("admin", "toString", "toString"), false);
});

test("superadmin acts on any registered office", () => {
  assert.ok(canAccessTenant("superadmin", "atrios", MARINHO));
  assert.ok(canAccessTenant("superadmin", "atrios", AURORA));
});

test("superadmin does not act on an unregistered office", () => {
  assert.equal(
    canAccessTenant("superadmin", "atrios", "serventia-que-saiu"),
    false,
  );
});

test("the superadmin sentinel office is never a registered one", () => {
  // What keeps a superadmin off every tenant's own /admin/usuarios list:
  // that page filters by eq(userTable.tenantSlug, tenant.slug), and
  // tenant.slug is always a registered one.
  assert.equal(isRegisteredSlug(SUPERADMIN_TENANT_SLUG), false);
});

test("superadmin has every permission", () => {
  for (const permission of [
    "admin.access",
    "content.publish",
    "billing.edit",
    "user.manage",
    "chat.settings",
  ] as const) {
    assert.ok(can("superadmin", permission));
  }
});

test("the last active admin cannot be deactivated", () => {
  assert.ok(isLastActiveAdmin("admin", 0));
});

test("an admin is not the last one when another admin is still active", () => {
  assert.equal(isLastActiveAdmin("admin", 1), false);
});

test("staff never trips the last-admin protection", () => {
  assert.equal(isLastActiveAdmin("staff", 0), false);
});

test("an account with disabledAt set is disabled", () => {
  assert.ok(isAccountDisabled(new Date()));
});

test("an account with no disabledAt is not disabled", () => {
  assert.equal(isAccountDisabled(null), false);
  assert.equal(isAccountDisabled(undefined), false);
});
