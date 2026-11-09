import "server-only";
import { and, eq, isNull, max } from "drizzle-orm";
import {
  checkFloor,
  type DocumentNumbering,
  floorOf,
  type NumberSeries,
  nextSequence,
  parseDocumentNumbering,
} from "@/core/numbering/series.ts";
import { KIND_BY_PREFIX } from "@/core/request/kinds.ts";
import type { Database } from "@/db/index.ts";
import {
  appointments,
  serviceRequests,
  taxGuides,
  tenantContent,
} from "@/db/schema.ts";
import { OFFICE_NUMBERING_KEY } from "@/lib/office-config.ts";
import { recordAuditWith } from "./audit.ts";

/** Where the office told each numbered document to go on (core/numbering). */
export async function getDocumentNumberingWith(
  database: Database,
  tenantSlug: string,
): Promise<DocumentNumbering> {
  const [row] = await database
    .select({ published: tenantContent.published })
    .from(tenantContent)
    .where(
      and(
        eq(tenantContent.tenantSlug, tenantSlug),
        eq(tenantContent.key, OFFICE_NUMBERING_KEY),
      ),
    )
    .limit(1);
  return parseDocumentNumbering(row?.published);
}

/** The highest number of the series used in the year; 0 when none. */
export async function lastUsedWith(
  database: Database,
  tenantSlug: string,
  series: NumberSeries,
  year: number,
): Promise<number> {
  if (series === "guia") {
    // A deleted guia frees its number, as in the guias' own list.
    const [row] = await database
      .select({ last: max(taxGuides.sequence) })
      .from(taxGuides)
      .where(
        and(
          eq(taxGuides.tenantSlug, tenantSlug),
          eq(taxGuides.year, year),
          isNull(taxGuides.deletedAt),
        ),
      );
    return row?.last ?? 0;
  }
  if (series === "AGD") {
    const [row] = await database
      .select({ last: max(appointments.protocolSequence) })
      .from(appointments)
      .where(
        and(
          eq(appointments.tenantSlug, tenantSlug),
          eq(appointments.protocolYear, year),
        ),
      );
    return row?.last ?? 0;
  }
  const [row] = await database
    .select({ last: max(serviceRequests.protocolSequence) })
    .from(serviceRequests)
    .where(
      and(
        eq(serviceRequests.tenantSlug, tenantSlug),
        eq(serviceRequests.kind, KIND_BY_PREFIX[series]),
        eq(serviceRequests.protocolYear, year),
      ),
    );
  return row?.last ?? 0;
}

/**
 * The number the next document of the series takes. Read, then written by
 * the caller: the unique index of each table settles two at the same time.
 */
export async function nextNumberWith(
  database: Database,
  tenantSlug: string,
  series: NumberSeries,
  year: number,
): Promise<number> {
  const [lastUsed, numbering] = await Promise.all([
    lastUsedWith(database, tenantSlug, series, year),
    getDocumentNumberingWith(database, tenantSlug),
  ]);
  return nextSequence(lastUsed, floorOf(numbering, series, year));
}

export class NumberingError extends Error {}

/** Sets where the series goes on in the year, refusing a number in use. */
export async function saveNumberingFloorWith(
  database: Database,
  tenantSlug: string,
  series: NumberSeries,
  year: number,
  next: number,
  actorId: string,
): Promise<void> {
  const lastUsed = await lastUsedWith(database, tenantSlug, series, year);
  const problem = checkFloor(series, year, next, lastUsed);
  if (problem) throw new NumberingError(problem);

  const current = await getDocumentNumberingWith(database, tenantSlug);
  const updated: DocumentNumbering = {
    ...current,
    [series]: { ...(current[series] ?? {}), [String(year)]: next },
  };
  await database
    .insert(tenantContent)
    .values({
      tenantSlug,
      key: OFFICE_NUMBERING_KEY,
      published: updated,
      publishedAt: new Date(),
      updatedBy: actorId,
    })
    .onConflictDoUpdate({
      target: [tenantContent.tenantSlug, tenantContent.key],
      set: {
        published: updated,
        publishedAt: new Date(),
        updatedAt: new Date(),
        updatedBy: actorId,
      },
    });
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "office-settings.save",
    targetType: "tenant-content",
    targetId: `${OFFICE_NUMBERING_KEY}:${series}:${year}`,
  });
}
