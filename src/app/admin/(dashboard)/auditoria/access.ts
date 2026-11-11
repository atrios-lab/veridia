import "server-only";
import { can } from "@/core/auth/roles.ts";
import { TENANTS } from "@/core/tenant/resolve.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

/**
 * Who sees what in Auditoria: the Tabelião/Registrador (audit.manage) the
 * office's whole trail; the Átrios account every office's; anyone else only
 * the notifications addressed to them.
 */
export async function auditAccess() {
  const session = await getSession();
  if (!session) return null;
  const tenant = await getTenant();
  const role = session.user.role ?? "";
  const manager = can(role, "audit.manage", session.user.permissions);
  const platform = role === "superadmin";
  return { session, tenant, manager, platform };
}

/** The offices the trail is read from, for this person and this filter. */
export function trailScope(
  access: NonNullable<Awaited<ReturnType<typeof auditAccess>>>,
  chosen?: string,
): string[] | "all" {
  if (!access.platform) return [access.tenant.slug];
  if (chosen === "todas") return "all";
  if (chosen && chosen in TENANTS) return [chosen];
  return [access.tenant.slug];
}
