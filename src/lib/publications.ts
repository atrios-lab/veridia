import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import type { PublicationFormInput } from "@/core/publications/publication.ts";
import { isLive } from "@/core/publications/state.ts";
import { db } from "@/db/index.ts";
import { officePublications } from "@/db/schema.ts";
import { today } from "@/lib/tenant.ts";
import { recordAudit } from "./audit.ts";

export type PublicationRow = typeof officePublications.$inferSelect;

/** Every publication of the office, newest edit first — the panel groups
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
 * Saves a publication as a draft (no entry date) — the case that needs only
 * `content.edit`. Publishing it (setting an entry date for the first time)
 * is `updatePublication`, gated by `content.publish` in the action layer,
 * same split already drawn between the two permissions elsewhere in the
 * panel.
 */
export async function createPublication(
  tenantSlug: string,
  data: PublicationFormInput,
  actorId: string,
): Promise<{ id: string }> {
  const [created] = await db
    .insert(officePublications)
    .values({
      tenantSlug,
      kind: data.kind,
      title: data.title,
      body: data.body,
      publishAt: data.publishAt ?? null,
      expireAt: data.expireAt ?? null,
      createdBy: actorId,
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
 * `content.edit` — this function has no opinion, it only writes.
 */
export async function updatePublication(
  tenantSlug: string,
  id: string,
  data: PublicationFormInput,
  actorId: string,
): Promise<void> {
  await db
    .update(officePublications)
    .set({
      kind: data.kind,
      title: data.title,
      body: data.body,
      publishAt: data.publishAt ?? null,
      expireAt: data.expireAt ?? null,
      updatedAt: new Date(),
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
 * a second, SQL-only version of the same rule — see design.md, "Estado é
 * sempre calculado".
 */
export async function livePublications(
  tenantSlug: string,
): Promise<PublicationRow[]> {
  const rows = await db
    .select()
    .from(officePublications)
    .where(
      and(
        eq(officePublications.tenantSlug, tenantSlug),
        isNull(officePublications.archivedAt),
      ),
    )
    .orderBy(desc(officePublications.publishAt));
  const day = today();
  return rows.filter((row) => isLive(row, day));
}
