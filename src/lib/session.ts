import "server-only";
import { headers } from "next/headers";
import { exemptRole, mayAccess } from "@/core/auth/access-hours.ts";
import {
  canAccessTenant,
  effectivePermissions,
  isAccountDisabled,
} from "@/core/auth/roles.ts";
import { isAccessConfirmed } from "./access-code.ts";
import { getAccessHours } from "./access-hours.ts";
import { auth } from "./auth.ts";
import { getRolePermissions } from "./role-permissions.ts";
import { getTenant } from "./tenant.ts";

/**
 * The session after the password alone: the right person of the right
 * office, but not yet through the e-mail code. Only the access-code screen
 * (admin/acesso) and the panel's redirect use it; everything else asks
 * `getSession`.
 */
export async function getPendingSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  if (isAccountDisabled(session.user.disabledAt)) return null;

  const tenant = await getTenant();
  if (
    !canAccessTenant(
      session.user.role ?? "",
      session.user.tenantSlug ?? "",
      tenant.slug,
    )
  )
    return null;

  return session;
}

/**
 * Authoritative session check, and the single place the office and the
 * second step are enforced.
 *
 * It hits the database, so a session revoked there is gone on the very next
 * request. It refuses a session whose user belongs to another office, which
 * is what makes a cookie issued on the wrong domain inert. And it refuses a
 * session that has not confirmed the e-mail code yet (lib/access-code.ts):
 * being here, not in the menu, is what makes every screen, action and route
 * ask for it.
 */
export async function getSession() {
  const session = await confirmedSession();
  if (!session) return null;
  // Outside the office's hours the panel is closed for whoever the
  // Tabelião/Registrador has not released (decision of 11/11/2026): every
  // screen, action and route, since they all come through here. The
  // dashboard shows such a person the closed screen instead
  // (getClosedHoursSession).
  if (!(await insideAccessHours(session))) return null;
  return session;
}

/**
 * A session that would be valid if the panel were open: the person's
 * hours are over. Only the dashboard's closed screen and its "pedir
 * liberação" action use it.
 */
export async function getClosedHoursSession() {
  const session = await confirmedSession();
  if (!session) return null;
  return (await insideAccessHours(session)) ? null : session;
}

type Confirmed = NonNullable<Awaited<ReturnType<typeof confirmedSession>>>;

async function insideAccessHours(session: Confirmed): Promise<boolean> {
  const role = session.user.role ?? "";
  if (exemptRole(role)) return true;
  const hours = await getAccessHours(session.user.tenantSlug ?? "");
  return mayAccess(hours, role, session.user.id, new Date());
}

async function confirmedSession() {
  const session = await getPendingSession();
  if (!session) return null;
  if (!(await isAccessConfirmed(session))) return null;
  // What this person may do here: the position's defaults or what the
  // Tabelião/Registrador set for it. Every check passes it to `can`.
  const role = session.user.role ?? "";
  const configured =
    role === "admin" || role === "superadmin"
      ? undefined
      : await getRolePermissions(session.user.tenantSlug ?? "");
  return {
    ...session,
    user: {
      ...session.user,
      permissions: effectivePermissions(role, configured),
    },
  };
}
