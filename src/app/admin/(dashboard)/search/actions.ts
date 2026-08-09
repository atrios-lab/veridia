"use server";

import { can } from "@/core/auth/roles.ts";
import { ROUTE_BY_KIND } from "@/core/overview/desk.ts";
import { type RequestKind, statusLabel } from "@/core/request/kinds.ts";
import { classifySearchTerm } from "@/core/request/search.ts";
import { searchRecords } from "@/lib/service-request.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

export interface GlobalSearchResult {
  kind: RequestKind;
  channelLabel: string;
  protocolNumber: string;
  applicantName: string | null;
  statusLabel: string;
  href: string;
}

const CHANNEL_LABELS: Record<RequestKind, string> = {
  "service-request": "Pedido",
  appointment: "Agenda",
  "data-rights": "LGPD",
  ombudsman: "Ouvidoria",
};

const MIN_QUERY_LENGTH = 2;

/**
 * The global search's one entry point. Gating happens here, on the server,
 * from the session's own role, never trusted from the client, same
 * discipline as every other action in the panel: what the overlay is
 * allowed to search is exactly what the sidebar would have let this session
 * navigate to.
 */
export async function searchGlobally(
  query: string,
): Promise<GlobalSearchResult[]> {
  const session = await getSession();
  if (!session) return [];

  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) return [];

  const role = session.user.role ?? "";
  const kinds: RequestKind[] = [
    ...(can(role, "requests.manage") ? (["service-request"] as const) : []),
    ...(can(role, "channels.manage")
      ? (["appointment", "data-rights", "ombudsman"] as const)
      : []),
  ];
  if (kinds.length === 0) return [];

  const tenant = await getTenant();
  const term = classifySearchTerm(trimmed);
  const records = await searchRecords(tenant.slug, term, kinds);

  return records.map((record) => ({
    kind: record.kind,
    channelLabel: CHANNEL_LABELS[record.kind],
    protocolNumber: record.protocolNumber,
    applicantName: record.applicantName,
    statusLabel: statusLabel(record.kind, record.status),
    href: `${ROUTE_BY_KIND[record.kind]}/${encodeURIComponent(record.protocolNumber)}`,
  }));
}
