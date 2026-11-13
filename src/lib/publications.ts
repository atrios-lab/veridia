import "server-only";
import { and, asc, desc, eq, isNotNull, isNull } from "drizzle-orm";
import {
  type AttachmentStatus,
  attachmentStatus,
} from "@/core/publications/attachment-retention.ts";
import type { PublicationFormInput } from "@/core/publications/publication.ts";
import { isLive, publicationState } from "@/core/publications/state.ts";
import type { IsoDate } from "@/core/scheduling/calendar.ts";
import { toIsoDate } from "@/core/scheduling/calendar.ts";
import { OFFICE_TIME_ZONE } from "@/core/time/office-time.ts";
import { user } from "@/db/auth-schema.ts";
import { db } from "@/db/index.ts";
import { auditLog, officePublications } from "@/db/schema.ts";
import { today } from "@/lib/office-config.ts";
import { notByPlatform, recordAudit } from "./audit.ts";
import { deleteStoredFile } from "./uploads.ts";

export type PublicationRow = typeof officePublications.$inferSelect;

/** Every publication of the office, newest edit first: the panel groups
 * these into tabs itself, via `publicationState()`. */
export async function listPublications(
  tenantSlug: string,
): Promise<PublicationRow[]> {
  return db
    .select()
    .from(officePublications)
    .where(eq(officePublications.tenantSlug, tenantSlug))
    .orderBy(desc(officePublications.updatedAt));
}

export async function getPublication(
  tenantSlug: string,
  id: string,
): Promise<PublicationRow | undefined> {
  const [row] = await db
    .select()
    .from(officePublications)
    .where(
      and(
        eq(officePublications.tenantSlug, tenantSlug),
        eq(officePublications.id, id),
      ),
    );
  return row;
}

/**
 * Saves a publication as a draft (no entry date): the case that needs only
 * `content.edit`. Publishing it (setting an entry date for the first time)
 * is `updatePublication`, gated by `content.publish` in the action layer,
 * same split already drawn between the two permissions elsewhere in the
 * panel.
 */
/** The edital's own document, when the operator attached one. */
export interface PublicationAttachment {
  storedName: string;
  displayName: string;
  path: string;
  mimeType: string;
  sizeBytes: number;
}

function attachmentColumns(file: PublicationAttachment | undefined) {
  if (!file) return {};
  return {
    attachmentStoredName: file.storedName,
    attachmentDisplayName: file.displayName,
    attachmentPath: file.path,
    attachmentMimeType: file.mimeType,
    attachmentSizeBytes: file.sizeBytes,
    // A new file starts its own 30 days (see attachment-retention.ts).
    attachmentUploadedAt: new Date(),
    attachmentPurgedAt: null,
  };
}

/** Where a row's file stands today under the 30-day rule. */
export function publicationAttachmentStatus(
  row: PublicationRow,
  today: IsoDate,
): AttachmentStatus {
  return attachmentStatus(
    {
      hasFile: Boolean(row.attachmentPath),
      uploadedOn: row.attachmentUploadedAt
        ? toIsoDate(row.attachmentUploadedAt, OFFICE_TIME_ZONE)
        : null,
      purged: Boolean(row.attachmentPurgedAt),
      state: publicationState(row, today),
    },
    today,
  );
}

/**
 * Deletes, from storage, every file of this office past its 30 days and
 * off the site, and clears its path on the row: the text, the dates and the
 * file's name, type and size stay as the record. Run when the panel's list
 * opens, the same "computed when read" stance the publication states take:
 * no scheduled job to forget about, and the routes already refuse to serve
 * an expired file before it is physically gone (see `attachmentServable`).
 *
 * Returns how many files it removed.
 */
export async function purgeExpiredAttachments(
  tenantSlug: string,
  today: IsoDate,
): Promise<number> {
  const rows = await db
    .select()
    .from(officePublications)
    .where(
      and(
        eq(officePublications.tenantSlug, tenantSlug),
        isNotNull(officePublications.attachmentPath),
      ),
    );
  let purged = 0;
  for (const row of rows) {
    if (publicationAttachmentStatus(row, today).kind !== "expired") continue;
    const path = row.attachmentPath;
    // Row first: a row pointing at a deleted file would be a broken link;
    // a file nobody points at is only a leftover.
    await db
      .update(officePublications)
      .set({ attachmentPath: null, attachmentPurgedAt: new Date() })
      .where(
        and(
          eq(officePublications.tenantSlug, tenantSlug),
          eq(officePublications.id, row.id),
        ),
      );
    if (path) await deleteStoredFile(path);
    await recordAudit({
      tenantSlug,
      // The platform did it, by the 30-day rule: no person to name.
      actorId: null,
      action: "publication.attachment-purge",
      targetType: "publication",
      targetId: row.id,
    });
    purged++;
  }
  return purged;
}

export interface PublicationHistoryEntry {
  action: string;
  at: Date;
  /** The operator's name; null when the platform acted (the 30-day rule). */
  actorName: string | null;
}

/** Who did what to a publication, oldest first, from the audit trail. */
export async function publicationHistory(
  tenantSlug: string,
  id: string,
  /** The Átrios account's own acts: only the Átrios account sees them. */
  includePlatform = false,
): Promise<PublicationHistoryEntry[]> {
  const rows = await db
    .select({
      action: auditLog.action,
      at: auditLog.createdAt,
      actorName: user.name,
    })
    .from(auditLog)
    .leftJoin(user, eq(user.id, auditLog.actorId))
    .where(
      and(
        eq(auditLog.tenantSlug, tenantSlug),
        eq(auditLog.targetType, "publication"),
        eq(auditLog.targetId, id),
        includePlatform ? undefined : notByPlatform(),
      ),
    )
    .orderBy(asc(auditLog.createdAt));
  return rows;
}

export async function createPublication(
  tenantSlug: string,
  data: PublicationFormInput,
  actorId: string,
  file?: PublicationAttachment,
): Promise<{ id: string }> {
  const [created] = await db
    .insert(officePublications)
    .values({
      tenantSlug,
      kind: data.kind,
      sector: data.sector,
      noticeType: data.noticeType,
      title: data.title,
      body: data.body,
      publishAt: data.publishAt ?? null,
      expireAt: data.expireAt ?? null,
      createdBy: actorId,
      ...attachmentColumns(file),
    })
    .returning({ id: officePublications.id });
  await recordAudit({
    tenantSlug,
    actorId,
    action: "publication.create",
    targetType: "publication",
    targetId: created.id,
  });
  return created;
}

/**
 * Rewrites a publication's content and dates, whatever state it is in. The
 * caller decides, before calling this, whether the change needs
 * `content.publish` (an entry date appearing for the first time) or only
 * `content.edit`: this function has no opinion, it only writes.
 */
export async function updatePublication(
  tenantSlug: string,
  id: string,
  data: PublicationFormInput,
  actorId: string,
  /** Absent leaves the current file alone; present replaces it. */
  file?: PublicationAttachment,
): Promise<void> {
  await db
    .update(officePublications)
    .set({
      kind: data.kind,
      sector: data.sector,
      noticeType: data.noticeType,
      title: data.title,
      body: data.body,
      publishAt: data.publishAt ?? null,
      expireAt: data.expireAt ?? null,
      updatedAt: new Date(),
      ...attachmentColumns(file),
    })
    .where(
      and(
        eq(officePublications.tenantSlug, tenantSlug),
        eq(officePublications.id, id),
      ),
    );
  await recordAudit({
    tenantSlug,
    actorId,
    action: "publication.update",
    targetType: "publication",
    targetId: id,
  });
}

/**
 * "Excluir": removes a publication made by mistake, row and all. Returns the
 * row as it was, so the caller can remove its file from storage after the
 * row is gone (a missing file is a leftover; a row pointing at a deleted
 * file would be a broken link). The audit entry is the trail: the row
 * itself leaves nothing behind.
 */
export async function deletePublication(
  tenantSlug: string,
  id: string,
  actorId: string,
): Promise<PublicationRow | undefined> {
  const [deleted] = await db
    .delete(officePublications)
    .where(
      and(
        eq(officePublications.tenantSlug, tenantSlug),
        eq(officePublications.id, id),
      ),
    )
    .returning();
  if (!deleted) return undefined;
  await recordAudit({
    tenantSlug,
    actorId,
    action: "publication.delete",
    targetType: "publication",
    targetId: id,
  });
  return deleted;
}

/** "Arquivar agora": takes it off the site before its exit date, by hand. */
export async function archivePublication(
  tenantSlug: string,
  id: string,
  actorId: string,
): Promise<void> {
  await db
    .update(officePublications)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(officePublications.tenantSlug, tenantSlug),
        eq(officePublications.id, id),
      ),
    );
  await recordAudit({
    tenantSlug,
    actorId,
    action: "publication.archive",
    targetType: "publication",
    targetId: id,
  });
}

/**
 * The publications the public home shows, newest entry date first. Fetches
 * every not-manually-archived row and filters with `isLive`, the same pure
 * function the panel's tabs use, rather than repeating the live condition as
 * a second, SQL-only version of the same rule: see design.md, "Estado é
 * sempre calculado".
 */
export async function livePublications(
  tenantSlug: string,
): Promise<PublicationRow[]> {
  let rows: PublicationRow[];
  try {
    rows = await db
      .select()
      .from(officePublications)
      .where(
        and(
          eq(officePublications.tenantSlug, tenantSlug),
          isNull(officePublications.archivedAt),
        ),
      )
      .orderBy(desc(officePublications.publishAt));
  } catch {
    // Same posture as `readTenantOverrides` in src/lib/tenant.ts: a database
    // that is down serves a home page without the editais section instead of
    // no home page at all. The section already disappears when the office has
    // published nothing, so the empty case is a shape the page knows.
    return [];
  }
  const day = today();
  return rows.filter((row) => isLive(row, day));
}
