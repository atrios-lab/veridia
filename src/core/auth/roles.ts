import { isRegisteredSlug } from "../tenant/resolve.ts";

// The auth library answers "who is this". What each role may do, and which
// office they may do it in, is decided here, as pure functions, so replacing
// the library never means rewriting authorization.

export const ROLES = ["admin", "staff"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "admin.access",
  "content.edit",
  "content.publish",
  "branding.edit",
  "billing.edit",
  "user.manage",
  "requests.manage",
  "channels.manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  admin: PERMISSIONS,
  // Staff drafts and edits, but publishing, billing and user management stay
  // with the office owner: those are the actions nobody can undo quietly, and
  // the Pix key is where the citizen's money lands. Working the request
  // queue and the three citizen channels (agenda, ouvidoria, LGPD) is the
  // opposite: it is staff's actual day job, so it is granted here too.
  staff: ["admin.access", "content.edit", "requests.manage", "channels.manage"],
};

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export function can(role: string, permission: Permission): boolean {
  return isRole(role) && ROLE_PERMISSIONS[role].includes(permission);
}

/**
 * Whether a panel user may act on an office. A user belongs to exactly one,
 * and no role widens that: the role says what the person does, this says
 * where. Callers combine the two, so each one can report which failed.
 *
 * An orphan slug, one whose office left the registry, authorizes nothing.
 * The failure mode has to be no access, never access to the wrong office.
 */
export function canAccessTenant(
  userTenantSlug: string,
  tenantSlug: string,
): boolean {
  if (!userTenantSlug || !isRegisteredSlug(userTenantSlug)) return false;
  return userTenantSlug === tenantSlug;
}
