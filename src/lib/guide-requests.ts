import "server-only";
import {
  and,
  desc,
  eq,
  inArray,
  isNull,
  max,
  notInArray,
  sql,
} from "drizzle-orm";
import { TAX_GUIDE_ACT_IDS } from "@/core/acts/catalog.ts";
import { formatGuideNumber } from "@/core/guides/schema.ts";
import { TERMINAL_SERVICE_REQUEST_STATUSES } from "@/core/request/kinds.ts";
import { type Database, db } from "@/db/index.ts";
import {
  serviceRequestAttachments,
  serviceRequestRequirementMessages,
  serviceRequestRequirements,
  serviceRequests,
  taxGuides,
} from "@/db/schema.ts";

/**
 * The citizens' requests for a guia de recolhimento, worked in the panel's
 * Utilitários instead of the Pedidos queue: what came in, what the citizen
 * moved since (a document, an answer to an exigência, a comprovante), and
 * the guia drawn for each.
 */
export interface GuideRequestRow {
  id: string;
  protocolNumber: string;
  applicantName: string | null;
  status: string;
  createdAt: Date;
  /** The citizen's last move after filing: a file or a message. */
  citizenUpdatedAt: Date | null;
  /** "006/2026", the guia drawn for the request, when there is one. */
  guideNumber: string | null;
}

/** Files and messages from the citizen, per request: the "atualizou" clock. */
async function lastCitizenActivity(
  database: Database,
  tenantSlug: string,
  ids: string[],
): Promise<Map<string, Date>> {
  const result = new Map<string, Date>();
  if (ids.length === 0) return result;
  const [files, messages] = await Promise.all([
    database
      .select({
        id: serviceRequestAttachments.requestId,
        at: max(serviceRequestAttachments.createdAt),
      })
      .from(serviceRequestAttachments)
      .where(
        and(
          eq(serviceRequestAttachments.tenantSlug, tenantSlug),
          inArray(serviceRequestAttachments.requestId, ids),
          // The counter's own files are not the citizen's news.
          inArray(serviceRequestAttachments.kind, [
            "citizen",
            "payment-receipt",
            "signed-form",
          ]),
        ),
      )
      .groupBy(serviceRequestAttachments.requestId),
    database
      .select({
        id: serviceRequestRequirements.requestId,
        at: max(serviceRequestRequirementMessages.createdAt),
      })
      .from(serviceRequestRequirementMessages)
      .innerJoin(
        serviceRequestRequirements,
        eq(
          serviceRequestRequirements.id,
          serviceRequestRequirementMessages.requirementId,
        ),
      )
      .where(
        and(
          eq(serviceRequestRequirementMessages.tenantSlug, tenantSlug),
          eq(serviceRequestRequirementMessages.author, "citizen"),
          inArray(serviceRequestRequirements.requestId, ids),
        ),
      )
      .groupBy(serviceRequestRequirements.requestId),
  ]);
  for (const row of [...files, ...messages]) {
    if (!row.at) continue;
    const at = new Date(row.at);
    const known = result.get(row.id);
    if (!known || at > known) result.set(row.id, at);
  }
  return result;
}

/** The guia requests, newest first (the latest 200), or only the open ones. */
export async function listGuideRequestsWith(
  database: Database,
  tenantSlug: string,
  { openOnly = false }: { openOnly?: boolean } = {},
): Promise<GuideRequestRow[]> {
  if (TAX_GUIDE_ACT_IDS.length === 0) return [];
  const rows = await database
    .select({
      id: serviceRequests.id,
      protocolNumber: serviceRequests.protocolNumber,
      applicantName: serviceRequests.applicantName,
      status: serviceRequests.status,
      createdAt: serviceRequests.createdAt,
    })
    .from(serviceRequests)
    .where(
      and(
        eq(serviceRequests.tenantSlug, tenantSlug),
        eq(serviceRequests.kind, "service-request"),
        inArray(serviceRequests.actId, [...TAX_GUIDE_ACT_IDS]),
        openOnly
          ? notInArray(serviceRequests.status, [
              ...TERMINAL_SERVICE_REQUEST_STATUSES,
            ])
          : undefined,
      ),
    )
    .orderBy(desc(serviceRequests.createdAt))
    .limit(200);
  const ids = rows.map((row) => row.id);
  const [activity, guides] = await Promise.all([
    lastCitizenActivity(database, tenantSlug, ids),
    ids.length === 0
      ? Promise.resolve([])
      : database
          .select({
            requestId: taxGuides.serviceRequestId,
            year: taxGuides.year,
            sequence: taxGuides.sequence,
          })
          .from(taxGuides)
          .where(
            and(
              eq(taxGuides.tenantSlug, tenantSlug),
              inArray(taxGuides.serviceRequestId, ids),
              isNull(taxGuides.deletedAt),
            ),
          ),
  ]);
  const guideOf = new Map(
    guides.map((guide) => [
      guide.requestId,
      formatGuideNumber(guide.year, guide.sequence),
    ]),
  );
  return rows.map((row) => {
    const moved = activity.get(row.id);
    // A file sent with the request itself is not an update.
    const updated =
      moved && moved.getTime() - row.createdAt.getTime() > 60_000
        ? moved
        : null;
    return {
      ...row,
      citizenUpdatedAt: updated,
      guideNumber: guideOf.get(row.id) ?? null,
    };
  });
}

export function listGuideRequests(
  tenantSlug: string,
  options?: { openOnly?: boolean },
): Promise<GuideRequestRow[]> {
  return listGuideRequestsWith(db, tenantSlug, options);
}

/** Open guia requests: the sidebar badge of "Guias de recolhimento". */
export async function openGuideRequestCount(
  tenantSlug: string,
): Promise<number> {
  if (TAX_GUIDE_ACT_IDS.length === 0) return 0;
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(serviceRequests)
    .where(
      and(
        eq(serviceRequests.tenantSlug, tenantSlug),
        eq(serviceRequests.kind, "service-request"),
        inArray(serviceRequests.actId, [...TAX_GUIDE_ACT_IDS]),
        notInArray(serviceRequests.status, [
          ...TERMINAL_SERVICE_REQUEST_STATUSES,
        ]),
      ),
    );
  return row?.count ?? 0;
}

/** What the panel's alert announces: a new guia request, or one the citizen moved. */
export interface GuideAlertItem {
  /** "new:<id>" or "update:<id>:<instant>": what a closed card remembers. */
  key: string;
  kind: "new" | "update";
  protocolNumber: string;
  applicantName: string | null;
  /** ISO instant of the news. */
  at: string;
}

/** The open requests' news, for the panel to compare with what it saw. */
export async function guideAlertSnapshotWith(
  database: Database,
  tenantSlug: string,
): Promise<GuideAlertItem[]> {
  const open = await listGuideRequestsWith(database, tenantSlug, {
    openOnly: true,
  });
  return open.flatMap((row): GuideAlertItem[] => {
    const items: GuideAlertItem[] = [
      {
        key: `new:${row.id}`,
        kind: "new",
        protocolNumber: row.protocolNumber,
        applicantName: row.applicantName,
        at: row.createdAt.toISOString(),
      },
    ];
    if (row.citizenUpdatedAt) {
      items.push({
        key: `update:${row.id}:${row.citizenUpdatedAt.toISOString()}`,
        kind: "update",
        protocolNumber: row.protocolNumber,
        applicantName: row.applicantName,
        at: row.citizenUpdatedAt.toISOString(),
      });
    }
    return items;
  });
}
