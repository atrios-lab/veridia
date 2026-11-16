import "server-only";
import { can } from "@/core/auth/roles.ts";
import { PROTOCOL_PREFIXES } from "@/core/request/protocol.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

/**
 * Who reads the demonstration office's held e-mail: anyone at its desk,
 * participant or Átrios. The screens do not exist in a real office, whose
 * messages go out and are never held.
 */
export async function demoOutboxAccess() {
  const session = await getSession();
  if (!session) return null;
  const tenant = await getTenant();
  if (!tenant.demo) return null;
  if (!can(session.user.role ?? "", "desk.access", session.user.permissions))
    return null;
  return { session, tenant };
}

/**
 * The panel page of the record a held message is about, from its protocol's
 * prefix (REQ, SOL, OUV); null for none or for an appointment, whose page
 * is reached by id (the screen looks it up).
 */
export function requestHref(protocol: string | null): string | null {
  if (!protocol) return null;
  const base = REQUEST_PAGES[protocol.slice(0, 3)];
  return base ? `${base}/${encodeURIComponent(protocol)}` : null;
}

const REQUEST_PAGES: Record<string, string> = {
  [PROTOCOL_PREFIXES.serviceRequest]: "/admin/pedidos",
  [PROTOCOL_PREFIXES.dataRights]: "/admin/lgpd",
  [PROTOCOL_PREFIXES.ombudsman]: "/admin/ouvidoria",
};
