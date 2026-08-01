// The auth library answers "who is this". What each role may do is decided
// here, as pure functions, so replacing the library never means rewriting
// authorization.

export const ROLES = ["admin", "staff"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "admin.access",
  "content.edit",
  "content.publish",
  "branding.edit",
  "user.manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  admin: PERMISSIONS,
  // Staff drafts and edits, but publishing and user management stay with the
  // office owner: those are the two actions nobody can undo quietly.
  staff: ["admin.access", "content.edit"],
};

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export function can(role: string, permission: Permission): boolean {
  return isRole(role) && ROLE_PERMISSIONS[role].includes(permission);
}
