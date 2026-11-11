import "server-only";
import { and, eq, isNull, max } from "drizzle-orm";
import {
  checkFloor,
  type DocumentNumbering,
  floorOf,
  lowestFree,
  type NumberSeries,
  nextSequence,
  parseDocumentNumbering,
  reusesFreedNumbers,
} from "@/core/numbering/series.ts";
import { KIND_BY_PREFIX } from "@/core/request/kinds.ts";
import type { Database } from "@/db/index.ts";
import {
  appointments,
  auditNotifications,
  issDeclarations,
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
  if (series === "declaracao-iss") {
    const [row] = await database
      .select({ last: max(issDeclarations.sequence) })
      .from(issDeclarations)
      .where(
        and(
          eq(issDeclarations.tenantSlug, tenantSlug),
          eq(issDeclarations.year, year),
          isNull(issDeclarations.deletedAt),
        ),
      );
    return row?.last ?? 0;
  }
  if (series === "notificacao") {
    const [row] = await database
      .select({ last: max(auditNotifications.sequence) })
      .from(auditNotifications)
      .where(
        and(
          eq(auditNotifications.tenantSlug, tenantSlug),
          eq(auditNotifications.year, year),
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
  if (reusesFreedNumbers(series)) {
    const [used, numbering] = await Promise.all([
      usedNumbersWith(database, tenantSlug, series, year),
      getDocumentNumberingWith(database, tenantSlug),
    ]);
    return lowestFree(used, floorOf(numbering, series, year));
  }
  const [lastUsed, numbering] = await Promise.all([
    lastUsedWith(database, tenantSlug, series, year),
    getDocumentNumberingWith(database, tenantSlug),
  ]);
  return nextSequence(lastUsed, floorOf(numbering, series, year));
}

/** The live numbers of a series that reuses freed ones, in the year. */
export async function usedNumbersWith(
  database: Database,
  tenantSlug: string,
  series: NumberSeries,
  year: number,
): Promise<number[]> {
  if (series === "guia") {
    const rows = await database
      .select({ sequence: taxGuides.sequence })
      .from(taxGuides)
      .where(
        and(
          eq(taxGuides.tenantSlug, tenantSlug),
          eq(taxGuides.year, year),
          isNull(taxGuides.deletedAt),
        ),
      );
    return rows.map((row) => row.sequence);
  }
  if (series === "declaracao-iss") {
    const rows = await database
      .select({ sequence: issDeclarations.sequence })
      .from(issDeclarations)
      .where(
        and(
          eq(issDeclarations.tenantSlug, tenantSlug),
          eq(issDeclarations.year, year),
          isNull(issDeclarations.deletedAt),
        ),
      );
    return rows.map((row) => row.sequence);
  }
  return [];
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
  const [lastUsed, used] = await Promise.all([
    lastUsedWith(database, tenantSlug, series, year),
    usedNumbersWith(database, tenantSlug, series, year),
  ]);
  const problem = checkFloor(series, year, next, lastUsed, used);
  if (problem) throw new NumberingError(problem);

  const current = await getDocumentNumberingWith(database, tenantSlug);
  const updated: DocumentNumbering = {
    ...current,
    [series]: { ...(current[series] ?? {}), [String(year)]: next },
  };
  await writeNumbering(database, tenantSlug, updated, actorId);
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "office-settings.save",
    targetType: "tenant-content",
    targetId: `${OFFICE_NUMBERING_KEY}:${series}:${year}`,
  });
}

/**
 * Drops the number set by hand for the year: the series goes back to
 * counting on its own (the lowest free number, or the last one plus one).
 */
export async function clearNumberingFloorWith(
  database: Database,
  tenantSlug: string,
  series: NumberSeries,
  year: number,
  actorId: string,
): Promise<void> {
  const current = await getDocumentNumberingWith(database, tenantSlug);
  const { [String(year)]: _dropped, ...rest } = current[series] ?? {};
  const updated: DocumentNumbering = { ...current, [series]: rest };
  await writeNumbering(database, tenantSlug, updated, actorId);
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "office-settings.save",
    targetType: "tenant-content",
    targetId: `${OFFICE_NUMBERING_KEY}:${series}:${year}`,
  });
}

async function writeNumbering(
  database: Database,
  tenantSlug: string,
  updated: DocumentNumbering,
  actorId: string,
): Promise<void> {
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
}
