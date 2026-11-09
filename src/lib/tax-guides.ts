import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import {
  type Guide,
  GuideSchema,
  type GuideSettings,
  GuideSettingsSchema,
} from "@/core/guides/schema.ts";
import { defaultGuideSettings } from "@/core/guides/settings.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import { officeYear } from "@/core/time/office-time.ts";
import { isPostgresError, UNIQUE_VIOLATION } from "@/db/errors.ts";
import { type Database, db } from "@/db/index.ts";
import { taxGuides, tenantContent } from "@/db/schema.ts";
import { OFFICE_GUIDES_KEY } from "@/lib/office-config.ts";
import { recordAuditWith } from "./audit.ts";

export type TaxGuideRow = typeof taxGuides.$inferSelect;

/** A stored guia with its payload read back through the schema. */
export interface StoredGuide {
  id: string;
  year: number;
  sequence: number;
  guide: Guide;
  createdAt: Date;
}

function storedOf(row: TaxGuideRow): StoredGuide | undefined {
  const parsed = GuideSchema.safeParse(row.payload);
  if (!parsed.success) return undefined;
  return {
    id: row.id,
    year: row.year,
    sequence: row.sequence,
    guide: parsed.data,
    createdAt: row.createdAt,
  };
}

/* ----------------------------------------------------------------- settings */

/**
 * The office's settings for the guias: what it saved, or the defaults built
 * from its own registration (municipality, state) until it saves. A row that
 * fails the schema reads as the defaults rather than an error.
 */
export async function getGuideSettings(tenant: Tenant): Promise<GuideSettings> {
  try {
    const [row] = await db
      .select({ published: tenantContent.published })
      .from(tenantContent)
      .where(
        and(
          eq(tenantContent.tenantSlug, tenant.slug),
          eq(tenantContent.key, OFFICE_GUIDES_KEY),
        ),
      )
      .limit(1);
    const parsed = GuideSettingsSchema.safeParse(row?.published);
    if (parsed.success) return parsed.data;
  } catch {
    // The database being down shows the defaults, never a broken screen.
  }
  return defaultGuideSettings(tenant);
}

export async function saveGuideSettingsWith(
  database: Database,
  tenantSlug: string,
  settings: GuideSettings,
  actorId: string,
): Promise<void> {
  await database
    .insert(tenantContent)
    .values({
      tenantSlug,
      key: OFFICE_GUIDES_KEY,
      published: settings,
      publishedAt: new Date(),
      updatedBy: actorId,
    })
    .onConflictDoUpdate({
      target: [tenantContent.tenantSlug, tenantContent.key],
      set: {
        published: settings,
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
    targetId: OFFICE_GUIDES_KEY,
  });
}

/* ------------------------------------------------------------------- guias */

async function nextSequence(
  database: Database,
  tenantSlug: string,
  year: number,
): Promise<number> {
  const [last] = await database
    .select({ sequence: taxGuides.sequence })
    .from(taxGuides)
    .where(
      and(
        eq(taxGuides.tenantSlug, tenantSlug),
        eq(taxGuides.year, year),
        isNull(taxGuides.deletedAt),
      ),
    )
    .orderBy(desc(taxGuides.sequence))
    .limit(1);
  return (last?.sequence ?? 0) + 1;
}

const ATTEMPTS = 5;

/**
 * Issues a guia: the next number of the office's year, max + 1, and the
 * unique index settles a race (the loser takes the following number).
 */
export async function issueGuideWith(
  database: Database,
  tenantSlug: string,
  guide: Guide,
  actorId: string,
  now: Date = new Date(),
): Promise<StoredGuide> {
  const year = officeYear(now);
  for (let attempt = 1; ; attempt++) {
    try {
      const sequence = await nextSequence(database, tenantSlug, year);
      const [row] = await database
        .insert(taxGuides)
        .values({
          tenantSlug,
          kind: guide.kind,
          year,
          sequence,
          payload: guide,
          createdBy: actorId,
        })
        .returning();
      if (!row) throw new Error("guia não gravada");
      await recordAuditWith(database, {
        tenantSlug,
        actorId,
        action: "tax-guide.issue",
        targetType: "tax-guide",
        targetId: row.id,
      });
      return storedOf(row) as StoredGuide;
    } catch (error) {
      if (!isPostgresError(error, UNIQUE_VIOLATION) || attempt >= ATTEMPTS) {
        throw error;
      }
    }
  }
}

export function issueGuide(
  tenantSlug: string,
  guide: Guide,
  actorId: string,
): Promise<StoredGuide> {
  return issueGuideWith(db, tenantSlug, guide, actorId);
}

/** Corrects a guia already issued: same number, new content. */
export async function updateGuideWith(
  database: Database,
  tenantSlug: string,
  id: string,
  guide: Guide,
  actorId: string,
): Promise<StoredGuide | undefined> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return undefined;
  const [row] = await database
    .update(taxGuides)
    .set({ kind: guide.kind, payload: guide, updatedAt: new Date() })
    .where(
      and(
        eq(taxGuides.tenantSlug, tenantSlug),
        eq(taxGuides.id, id),
        isNull(taxGuides.deletedAt),
      ),
    )
    .returning();
  if (!row) return undefined;
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "tax-guide.update",
    targetType: "tax-guide",
    targetId: row.id,
  });
  return storedOf(row);
}

export function updateGuide(
  tenantSlug: string,
  id: string,
  guide: Guide,
  actorId: string,
): Promise<StoredGuide | undefined> {
  return updateGuideWith(db, tenantSlug, id, guide, actorId);
}

export async function findGuideWith(
  database: Database,
  tenantSlug: string,
  id: string,
): Promise<StoredGuide | undefined> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return undefined;
  const [row] = await database
    .select()
    .from(taxGuides)
    .where(
      and(
        eq(taxGuides.tenantSlug, tenantSlug),
        eq(taxGuides.id, id),
        isNull(taxGuides.deletedAt),
      ),
    )
    .limit(1);
  return row ? storedOf(row) : undefined;
}

export function findGuide(
  tenantSlug: string,
  id: string,
): Promise<StoredGuide | undefined> {
  return findGuideWith(db, tenantSlug, id);
}

/** The office's live guias, by year and then by number, newest first. */
export async function listGuidesWith(
  database: Database,
  tenantSlug: string,
  year?: number,
): Promise<StoredGuide[]> {
  const rows = await database
    .select()
    .from(taxGuides)
    .where(
      and(
        eq(taxGuides.tenantSlug, tenantSlug),
        isNull(taxGuides.deletedAt),
        year === undefined ? undefined : eq(taxGuides.year, year),
      ),
    )
    .orderBy(desc(taxGuides.year), desc(taxGuides.sequence));
  return rows.flatMap((row) => storedOf(row) ?? []);
}

export function listGuides(
  tenantSlug: string,
  year?: number,
): Promise<StoredGuide[]> {
  return listGuidesWith(db, tenantSlug, year);
}

/** The number is already a live guia's in that year. */
export class GuideNumberTakenError extends Error {}

/**
 * Gives a guia another number by hand ("003/2026" typed as 3 and 2026), for
 * a count that has to follow the office's own book. A number already taken
 * by a live guia is refused by the index, never silently doubled.
 */
export async function renumberGuideWith(
  database: Database,
  tenantSlug: string,
  id: string,
  year: number,
  sequence: number,
  actorId: string,
): Promise<StoredGuide | undefined> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return undefined;
  try {
    const [row] = await database
      .update(taxGuides)
      .set({ year, sequence, updatedAt: new Date() })
      .where(
        and(
          eq(taxGuides.tenantSlug, tenantSlug),
          eq(taxGuides.id, id),
          isNull(taxGuides.deletedAt),
        ),
      )
      .returning();
    if (!row) return undefined;
    await recordAuditWith(database, {
      tenantSlug,
      actorId,
      action: "tax-guide.renumber",
      targetType: "tax-guide",
      targetId: row.id,
    });
    return storedOf(row);
  } catch (error) {
    if (isPostgresError(error, UNIQUE_VIOLATION)) {
      throw new GuideNumberTakenError("número já usado");
    }
    throw error;
  }
}

export function renumberGuide(
  tenantSlug: string,
  id: string,
  year: number,
  sequence: number,
  actorId: string,
): Promise<StoredGuide | undefined> {
  return renumberGuideWith(db, tenantSlug, id, year, sequence, actorId);
}

/**
 * "Excluir", for a guia issued by mistake: out of every list and its number
 * free again. Nothing is erased: the row stays, marked, with the audit.
 */
export async function deleteGuideWith(
  database: Database,
  tenantSlug: string,
  id: string,
  actorId: string,
): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return false;
  const [row] = await database
    .update(taxGuides)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(taxGuides.tenantSlug, tenantSlug),
        eq(taxGuides.id, id),
        isNull(taxGuides.deletedAt),
      ),
    )
    .returning({ id: taxGuides.id });
  if (!row) return false;
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "tax-guide.delete",
    targetType: "tax-guide",
    targetId: row.id,
  });
  return true;
}

export function deleteGuide(
  tenantSlug: string,
  id: string,
  actorId: string,
): Promise<boolean> {
  return deleteGuideWith(db, tenantSlug, id, actorId);
}
