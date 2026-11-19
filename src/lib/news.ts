import "server-only";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import {
  MAX_PHOTOS,
  type NewsFileKind,
  type NewsFileRecord,
  type NewsInput,
  NewsInputSchema,
  type NewsRecord,
  newestFirst,
  type PublicNews,
  publicNews,
} from "@/core/news/news.ts";
import { type Database, db } from "@/db/index.ts";
import { officeNews, officeNewsFiles } from "@/db/schema.ts";
import { recordAuditWith } from "./audit.ts";

/**
 * The office's notice board (decision of 19/11/2026). Nothing here deletes a
 * row: a post leaves the lists by being archived, and a file taken off only
 * gets `removed_at` (the stored file is removed by the caller).
 */

export class NewsError extends Error {}

export type NewsRow = typeof officeNews.$inferSelect;
export type NewsFileRow = typeof officeNewsFiles.$inferSelect;

function toRecord(row: NewsRow, files: NewsFileRow[]): NewsRecord {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    eventDate: row.eventDate,
    summary: row.summary,
    body: row.body,
    published: row.published,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    imageConsent: row.imageConsent,
    archived: row.archivedAt !== null,
    files: files
      .filter((f) => f.newsId === row.id && f.removedAt === null)
      .map(
        (f): NewsFileRecord => ({
          id: f.id,
          kind: f.kind === "pdf" ? "pdf" : "photo",
          name: f.name,
          position: f.position,
        }),
      ),
  };
}

async function ownRow(
  database: Database,
  tenantSlug: string,
  id: string,
): Promise<NewsRow> {
  if (!/^[0-9a-f-]{36}$/i.test(id))
    throw new NewsError("Notícia não encontrada.");
  const [row] = await database
    .select()
    .from(officeNews)
    .where(and(eq(officeNews.tenantSlug, tenantSlug), eq(officeNews.id, id)))
    .limit(1);
  if (!row) throw new NewsError("Notícia não encontrada.");
  return row;
}

function parseInput(raw: NewsInput): NewsInput {
  const parsed = NewsInputSchema.safeParse(raw);
  if (!parsed.success) {
    throw new NewsError(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  }
  return parsed.data;
}

/** Every post of the office with its live files, newest first. */
export async function listNewsWith(
  database: Database,
  tenantSlug: string,
  options: { archived?: boolean } = {},
): Promise<NewsRecord[]> {
  const rows = await database
    .select()
    .from(officeNews)
    .where(eq(officeNews.tenantSlug, tenantSlug))
    .orderBy(desc(officeNews.eventDate), asc(officeNews.title));
  const files = await database
    .select()
    .from(officeNewsFiles)
    .where(
      and(
        eq(officeNewsFiles.tenantSlug, tenantSlug),
        isNull(officeNewsFiles.removedAt),
      ),
    )
    .orderBy(asc(officeNewsFiles.position), asc(officeNewsFiles.createdAt));
  const records = rows
    .filter((row) => options.archived || row.archivedAt === null)
    .map((row) => toRecord(row, files));
  return newestFirst(records);
}

export async function createNewsWith(
  database: Database,
  tenantSlug: string,
  raw: NewsInput,
  actorId: string,
): Promise<string> {
  const input = parseInput(raw);
  const now = new Date();
  const [row] = await database
    .insert(officeNews)
    .values({
      tenantSlug,
      title: input.title,
      category: input.category,
      eventDate: input.eventDate || null,
      summary: input.summary,
      body: input.body,
      published: input.published,
      publishedAt: input.published ? now : null,
      imageConsent: input.imageConsent,
      imageConsentAt: input.imageConsent ? now : null,
      createdBy: actorId,
      updatedBy: actorId,
    })
    .returning({ id: officeNews.id });
  if (!row) throw new NewsError("Não foi possível criar a notícia.");
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "news.create",
    targetType: "news",
    targetId: input.title.slice(0, 200),
  });
  if (input.published) {
    await recordAuditWith(database, {
      tenantSlug,
      actorId,
      action: "news.publish",
      targetType: "news",
      targetId: input.title.slice(0, 200),
    });
  }
  return row.id;
}

export async function updateNewsWith(
  database: Database,
  tenantSlug: string,
  id: string,
  raw: NewsInput,
  actorId: string,
): Promise<void> {
  const row = await ownRow(database, tenantSlug, id);
  const input = parseInput(raw);
  const now = new Date();
  await database
    .update(officeNews)
    .set({
      title: input.title,
      category: input.category,
      eventDate: input.eventDate || null,
      summary: input.summary,
      body: input.body,
      published: input.published,
      // The day it first went to the site is kept; a first publication sets it.
      publishedAt: input.published ? (row.publishedAt ?? now) : row.publishedAt,
      imageConsent: input.imageConsent,
      imageConsentAt: input.imageConsent
        ? input.imageConsent === row.imageConsent
          ? row.imageConsentAt
          : now
        : null,
      updatedBy: actorId,
      updatedAt: now,
    })
    .where(eq(officeNews.id, row.id));
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "news.update",
    targetType: "news",
    targetId: input.title.slice(0, 200),
  });
  if (input.published !== row.published) {
    await recordAuditWith(database, {
      tenantSlug,
      actorId,
      action: input.published ? "news.publish" : "news.unpublish",
      targetType: "news",
      targetId: input.title.slice(0, 200),
    });
  }
}

/**
 * Puts a photo or the PDF on a post. The PDF replaces the previous one (kept
 * as a removed row); returns the path it replaced, for the caller to remove
 * from the store. A post holds at most `MAX_PHOTOS` photos.
 */
export async function addFileWith(
  database: Database,
  tenantSlug: string,
  id: string,
  kind: NewsFileKind,
  file: { path: string; name: string; mime: string },
  actorId: string,
): Promise<string | null> {
  const row = await ownRow(database, tenantSlug, id);
  const live = await database
    .select()
    .from(officeNewsFiles)
    .where(
      and(
        eq(officeNewsFiles.tenantSlug, tenantSlug),
        eq(officeNewsFiles.newsId, row.id),
        isNull(officeNewsFiles.removedAt),
      ),
    );
  const now = new Date();
  let previous: string | null = null;
  if (kind === "photo") {
    if (live.filter((f) => f.kind === "photo").length >= MAX_PHOTOS) {
      throw new NewsError(`Cada notícia pode ter até ${MAX_PHOTOS} fotos.`);
    }
  } else {
    const old = live.find((f) => f.kind === "pdf");
    if (old) {
      previous = old.path;
      await database
        .update(officeNewsFiles)
        .set({ removedAt: now, removedBy: actorId })
        .where(eq(officeNewsFiles.id, old.id));
    }
  }
  const position = live.reduce((max, f) => Math.max(max, f.position), 0) + 1;
  await database.insert(officeNewsFiles).values({
    tenantSlug,
    newsId: row.id,
    kind,
    position,
    path: file.path,
    name: file.name,
    mime: file.mime,
    createdBy: actorId,
  });
  await database
    .update(officeNews)
    .set({ updatedBy: actorId, updatedAt: now })
    .where(eq(officeNews.id, row.id));
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: kind === "photo" ? "news.photo-add" : "news.pdf-set",
    targetType: "news",
    targetId: row.title.slice(0, 200),
  });
  return previous;
}

/** Takes a file off a post (the row stays); returns its path, for the caller to remove. */
export async function removeFileWith(
  database: Database,
  tenantSlug: string,
  newsId: string,
  fileId: string,
  actorId: string,
): Promise<string | null> {
  const row = await ownRow(database, tenantSlug, newsId);
  if (!/^[0-9a-f-]{36}$/i.test(fileId)) return null;
  const [file] = await database
    .select()
    .from(officeNewsFiles)
    .where(
      and(
        eq(officeNewsFiles.tenantSlug, tenantSlug),
        eq(officeNewsFiles.newsId, row.id),
        eq(officeNewsFiles.id, fileId),
        isNull(officeNewsFiles.removedAt),
      ),
    )
    .limit(1);
  if (!file) return null;
  const now = new Date();
  await database
    .update(officeNewsFiles)
    .set({ removedAt: now, removedBy: actorId })
    .where(eq(officeNewsFiles.id, file.id));
  await database
    .update(officeNews)
    .set({ updatedBy: actorId, updatedAt: now })
    .where(eq(officeNews.id, row.id));
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "news.file-remove",
    targetType: "news",
    targetId: row.title.slice(0, 200),
  });
  return file.path;
}

export async function archiveNewsWith(
  database: Database,
  tenantSlug: string,
  id: string,
  actorId: string,
): Promise<void> {
  const row = await ownRow(database, tenantSlug, id);
  await database
    .update(officeNews)
    .set({
      archivedAt: new Date(),
      archivedBy: actorId,
      updatedBy: actorId,
      updatedAt: new Date(),
    })
    .where(eq(officeNews.id, row.id));
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "news.archive",
    targetType: "news",
    targetId: row.title.slice(0, 200),
  });
}

export async function restoreNewsWith(
  database: Database,
  tenantSlug: string,
  id: string,
  actorId: string,
): Promise<void> {
  const row = await ownRow(database, tenantSlug, id);
  await database
    .update(officeNews)
    .set({
      archivedAt: null,
      archivedBy: null,
      updatedBy: actorId,
      updatedAt: new Date(),
    })
    .where(eq(officeNews.id, row.id));
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "news.restore",
    targetType: "news",
    targetId: row.title.slice(0, 200),
  });
}

// The site ---------------------------------------------------------------

/** What the visitor sees: the posts marked for the site, newest first. */
export async function publicNewsWith(
  database: Database,
  tenantSlug: string,
): Promise<PublicNews[]> {
  const records = await listNewsWith(database, tenantSlug);
  return newestFirst(
    records.flatMap((record) => {
      const shown = publicNews(record);
      return shown ? [shown] : [];
    }),
  );
}

/** The visitor's view of the board; empty if the database cannot be read. */
export async function publicNewsList(
  tenantSlug: string,
): Promise<PublicNews[]> {
  try {
    return await publicNewsWith(db, tenantSlug);
  } catch {
    return [];
  }
}

/** One post for the visitor, or null when it is not on the site. */
export async function publicNewsOneWith(
  database: Database,
  tenantSlug: string,
  id: string,
): Promise<PublicNews | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const all = await publicNewsWith(database, tenantSlug);
  return all.find((post) => post.id === id) ?? null;
}

export interface NewsFile {
  path: string;
  mime: string;
  name: string;
}

/**
 * A stored file of a post. For the site (`publicOnly`): only of a post that
 * is published and not archived, the photos only with the image
 * authorisation, and never one that was taken off.
 */
export async function newsFileWith(
  database: Database,
  tenantSlug: string,
  fileId: string,
  options: { publicOnly: boolean },
): Promise<NewsFile | null> {
  if (!/^[0-9a-f-]{36}$/i.test(fileId)) return null;
  const [file] = await database
    .select()
    .from(officeNewsFiles)
    .where(
      and(
        eq(officeNewsFiles.tenantSlug, tenantSlug),
        eq(officeNewsFiles.id, fileId),
        isNull(officeNewsFiles.removedAt),
      ),
    )
    .limit(1);
  if (!file) return null;
  if (options.publicOnly) {
    const [post] = await database
      .select()
      .from(officeNews)
      .where(
        and(
          eq(officeNews.tenantSlug, tenantSlug),
          eq(officeNews.id, file.newsId),
        ),
      )
      .limit(1);
    if (!post || !post.published || post.archivedAt) return null;
    if (file.kind === "photo" && !post.imageConsent) return null;
  }
  return { path: file.path, mime: file.mime, name: file.name };
}
