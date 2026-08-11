import "server-only";
import { and, asc, desc, eq, gt, lt, sql } from "drizzle-orm";
import type { BulletinStatus } from "@/core/transparency/bulletin.ts";
import type {
  DocumentFormInput,
  DocumentStatus,
} from "@/core/transparency/documents.ts";
import { db } from "@/db/index.ts";
import { transparencyBulletins, transparencyDocuments } from "@/db/schema.ts";
import { recordAudit } from "./audit.ts";

export type TransparencyDocumentRow = typeof transparencyDocuments.$inferSelect;
export type TransparencyBulletinRow = typeof transparencyBulletins.$inferSelect;

/** The office's stored file for a document: same shape the row's columns hold. */
export interface DocumentFile {
  storedName: string;
  displayName: string;
  path: string;
  mimeType: string;
  sizeBytes: number;
}

// ── Documents ──────────────────────────────────────────────────────────────

/**
 * Every document of the office, in the order it appears on the site. The panel
 * shows all states; the public page filters to `published` itself (via
 * `publishedDocuments`), so this stays a single ordering the two agree on.
 */
export async function listDocuments(
  tenantSlug: string,
): Promise<TransparencyDocumentRow[]> {
  return db
    .select()
    .from(transparencyDocuments)
    .where(eq(transparencyDocuments.tenantSlug, tenantSlug))
    .orderBy(asc(transparencyDocuments.position));
}

/** The published documents the public page lists, in panel order. */
export async function publishedDocuments(
  tenantSlug: string,
): Promise<TransparencyDocumentRow[]> {
  return db
    .select()
    .from(transparencyDocuments)
    .where(
      and(
        eq(transparencyDocuments.tenantSlug, tenantSlug),
        eq(transparencyDocuments.status, "published"),
      ),
    )
    .orderBy(asc(transparencyDocuments.position));
}

export async function getDocument(
  tenantSlug: string,
  id: string,
): Promise<TransparencyDocumentRow | undefined> {
  const [row] = await db
    .select()
    .from(transparencyDocuments)
    .where(
      and(
        eq(transparencyDocuments.tenantSlug, tenantSlug),
        eq(transparencyDocuments.id, id),
      ),
    );
  return row;
}

/**
 * Files a new document as a draft, at the bottom of the list. Position is
 * `max + 1`, read then written: two uploads at the same instant could pick
 * the same number, which only means the two share a rank until the next move,
 * never a lost row. Audited on create: a public document appearing is an act
 * the trail should carry, same as a publication.
 */
export async function createDocument(
  tenantSlug: string,
  data: DocumentFormInput,
  file: DocumentFile,
  actorId: string,
): Promise<{ id: string }> {
  const [last] = await db
    .select({ position: transparencyDocuments.position })
    .from(transparencyDocuments)
    .where(eq(transparencyDocuments.tenantSlug, tenantSlug))
    .orderBy(desc(transparencyDocuments.position))
    .limit(1);
  const position = (last?.position ?? 0) + 1;

  const [created] = await db
    .insert(transparencyDocuments)
    .values({
      tenantSlug,
      category: data.category,
      title: data.title,
      yearLabel: data.yearLabel,
      fileStoredName: file.storedName,
      fileDisplayName: file.displayName,
      filePath: file.path,
      fileMimeType: file.mimeType,
      fileSizeBytes: file.sizeBytes,
      status: "draft",
      position,
      createdBy: actorId,
    })
    .returning({ id: transparencyDocuments.id });
  await recordAudit({
    tenantSlug,
    actorId,
    action: "transparency.document.create",
    targetType: "transparency-document",
    targetId: created.id,
  });
  return created;
}

/** Draft or unpublished → published. Audited: it changes what the public sees. */
export async function publishDocument(
  tenantSlug: string,
  id: string,
  actorId: string,
): Promise<void> {
  await db
    .update(transparencyDocuments)
    .set({ status: "published", unpublishedAt: null, updatedAt: new Date() })
    .where(
      and(
        eq(transparencyDocuments.tenantSlug, tenantSlug),
        eq(transparencyDocuments.id, id),
      ),
    );
  await recordAudit({
    tenantSlug,
    actorId,
    action: "transparency.document.publish",
    targetType: "transparency-document",
    targetId: id,
  });
}

/** Published → unpublished, stamping when it left the site. Audited. */
export async function unpublishDocument(
  tenantSlug: string,
  id: string,
  actorId: string,
): Promise<void> {
  await db
    .update(transparencyDocuments)
    .set({
      status: "unpublished",
      unpublishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(transparencyDocuments.tenantSlug, tenantSlug),
        eq(transparencyDocuments.id, id),
      ),
    );
  await recordAudit({
    tenantSlug,
    actorId,
    action: "transparency.document.unpublish",
    targetType: "transparency-document",
    targetId: id,
  });
}

/**
 * Moves a document one step up or down by swapping positions with its
 * neighbour. One statement, not two writes: neon-http has no interactive
 * transaction, so a CASE update is what keeps the swap atomic: a crash can
 * never leave one row moved and the other not. A no-op (no neighbour, at an
 * end) returns false, and the action does not audit it: reordering is not a
 * change to public content, only to its order, and it happens often.
 */
export async function moveDocument(
  tenantSlug: string,
  id: string,
  direction: "up" | "down",
): Promise<boolean> {
  const current = await getDocument(tenantSlug, id);
  if (!current) return false;

  const [neighbour] = await db
    .select()
    .from(transparencyDocuments)
    .where(
      and(
        eq(transparencyDocuments.tenantSlug, tenantSlug),
        direction === "up"
          ? lt(transparencyDocuments.position, current.position)
          : gt(transparencyDocuments.position, current.position),
      ),
    )
    .orderBy(
      direction === "up"
        ? desc(transparencyDocuments.position)
        : asc(transparencyDocuments.position),
    )
    .limit(1);
  if (!neighbour) return false;

  await db
    .update(transparencyDocuments)
    .set({
      // The `::int` casts are load-bearing: interpolated numbers arrive as
      // untyped parameters, and Postgres resolves a CASE over untyped params
      // to text, which then will not assign to an integer column. The values
      // are positions read from this table a line above, never user input.
      position: sql`CASE ${transparencyDocuments.id}
        WHEN ${current.id} THEN ${neighbour.position}::int
        WHEN ${neighbour.id} THEN ${current.position}::int
      END`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(transparencyDocuments.tenantSlug, tenantSlug),
        sql`${transparencyDocuments.id} IN (${current.id}, ${neighbour.id})`,
      ),
    );
  return true;
}

/**
 * Deletes the row. The caller removes the stored file after this returns.
 * `recordAudit` lives here, in the function that removes it, not in the
 * action: this is the only path a document leaves by, and check:destructive
 * fails the build for a deletion without a trail beside it.
 */
export async function deleteDocument(
  tenantSlug: string,
  id: string,
  actorId: string,
): Promise<TransparencyDocumentRow | undefined> {
  const [deleted] = await db
    .delete(transparencyDocuments)
    .where(
      and(
        eq(transparencyDocuments.tenantSlug, tenantSlug),
        eq(transparencyDocuments.id, id),
      ),
    )
    .returning();
  if (deleted) {
    await recordAudit({
      tenantSlug,
      actorId,
      action: "transparency.document.delete",
      targetType: "transparency-document",
      targetId: id,
    });
  }
  return deleted;
}

// ── Bulletins ────────────────────────────────────────────────────────────────

/** The bulletins the office has published, most recent month first. */
export async function listBulletins(
  tenantSlug: string,
): Promise<TransparencyBulletinRow[]> {
  return db
    .select()
    .from(transparencyBulletins)
    .where(eq(transparencyBulletins.tenantSlug, tenantSlug))
    .orderBy(desc(transparencyBulletins.referenceMonth));
}

export async function getBulletin(
  tenantSlug: string,
  id: string,
): Promise<TransparencyBulletinRow | undefined> {
  const [row] = await db
    .select()
    .from(transparencyBulletins)
    .where(
      and(
        eq(transparencyBulletins.tenantSlug, tenantSlug),
        eq(transparencyBulletins.id, id),
      ),
    );
  return row;
}

export interface BulletinInput {
  /** First day of the covered month, "YYYY-MM-01". */
  referenceMonth: string;
  actsCount: number;
  grossRevenueCents: number;
  taxesPaidCents: number;
  expensesCents: number;
  status: BulletinStatus;
}

/**
 * Publishes a bulletin for its month, replacing any already there. The unique
 * index on (tenant, month) turns this into an upsert the database enforces:
 * publishing August again: as a correction, or to consolidate a preliminary
 * one: overwrites the row, so the site never shows two Augusts. The prior
 * figures live on only in the audit trail.
 */
export async function upsertBulletin(
  tenantSlug: string,
  input: BulletinInput,
  actorId: string,
): Promise<void> {
  await db
    .insert(transparencyBulletins)
    .values({
      tenantSlug,
      referenceMonth: input.referenceMonth,
      actsCount: input.actsCount,
      grossRevenueCents: input.grossRevenueCents,
      taxesPaidCents: input.taxesPaidCents,
      expensesCents: input.expensesCents,
      status: input.status,
      createdBy: actorId,
    })
    .onConflictDoUpdate({
      target: [
        transparencyBulletins.tenantSlug,
        transparencyBulletins.referenceMonth,
      ],
      set: {
        actsCount: input.actsCount,
        grossRevenueCents: input.grossRevenueCents,
        taxesPaidCents: input.taxesPaidCents,
        expensesCents: input.expensesCents,
        status: input.status,
        updatedAt: new Date(),
      },
    });
  await recordAudit({
    tenantSlug,
    actorId,
    action: "transparency.bulletin.publish",
    targetType: "transparency-bulletin",
    targetId: input.referenceMonth,
  });
}

/** The most recently published bulletin, for the module header line. */
export async function latestBulletin(
  tenantSlug: string,
): Promise<TransparencyBulletinRow | undefined> {
  const [row] = await db
    .select()
    .from(transparencyBulletins)
    .where(eq(transparencyBulletins.tenantSlug, tenantSlug))
    .orderBy(desc(transparencyBulletins.referenceMonth))
    .limit(1);
  return row;
}

/** A document's status is stored, so callers can narrow without a core call. */
export function documentStatusOf(row: TransparencyDocumentRow): DocumentStatus {
  return row.status as DocumentStatus;
}
