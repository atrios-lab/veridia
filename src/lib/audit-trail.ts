import "server-only";
import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lte,
  ne,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import { ANSWER_HOURS } from "@/core/audit/labels.ts";
import {
  type AuditLevel,
  auditLevel,
  exactActions,
  URGENT_VERBS_PATTERN,
} from "@/core/audit/severity.ts";
import { formatGuideNumber } from "@/core/guides/schema.ts";
import { officeYear } from "@/core/time/office-time.ts";
import { user } from "@/db/auth-schema.ts";
import type { Database } from "@/db/index.ts";
import {
  auditLog,
  auditNotes,
  auditNotificationFiles,
  auditNotifications,
  auditReviews,
} from "@/db/schema.ts";
import { notByPlatform, recordAuditWith } from "./audit.ts";
import { nextNumberWith } from "./document-numbering.ts";

/* ------------------------------------------------------------- the trail */

export interface AuditEntry {
  id: string;
  tenantSlug: string;
  actorId: string | null;
  actorName: string | null;
  actorRole: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  /** The target with any account id in it replaced by the person's name. */
  targetLabel: string | null;
  /** Why, for a sensitive act: typed by its author. */
  reason: string | null;
  level: AuditLevel;
  /** When the holder marked it as seen, and who. */
  reviewedAt: Date | null;
  reviewerName: string | null;
  createdAt: Date;
  notes: {
    id: string;
    body: string;
    createdAt: Date;
    editedAt: Date | null;
    authorName: string | null;
  }[];
}

export interface AuditFilter {
  /** One office, several (the Átrios account), or all of them. */
  tenantSlugs: string[] | "all";
  actorId?: string;
  from?: Date;
  to?: Date;
  /** Words in the action or the target. */
  text?: string;
  ids?: string[];
  /** Only these bands. */
  levels?: AuditLevel[];
  /** Only the urgent ones nobody has marked as seen. */
  pending?: boolean;
  /** Leaves out one person's acts (the holder's own, in the pending list). */
  excludeActorId?: string;
  /** The Átrios account's own acts: only the Átrios account sees them. */
  includePlatform?: boolean;
  /** true: only what the holder archived; otherwise archived ones stay out. */
  archived?: boolean;
  limit?: number;
}

const ACCOUNT_ID = /\b[A-Za-z0-9]{32}\b/g;

/** What a form sent, with the browser's CRLF turned into plain newlines. */
const typed = (text: string) => text.replace(/\r\n?/g, "\n").trim();

/** The band of an entry, worked out by the database: same rule as the core. */
function levelSql(): SQL<string> {
  const list = (level: AuditLevel) => {
    const codes = exactActions(level);
    return codes.length
      ? sql`${auditLog.action} in (${sql.join(
          codes.map((code) => sql`${code}`),
          sql`, `,
        )})`
      : sql`false`;
  };
  return sql<string>`case
    when ${list("urgente")} then 'urgente'
    when ${list("atencao")} then 'atencao'
    when ${list("analise")} then 'analise'
    when ${auditLog.action} ~ ${URGENT_VERBS_PATTERN} then 'urgente'
    else 'rotina' end`;
}

/**
 * How far back an urgent act still alerts: the trail before the bands
 * existed is history, not a pile of alerts on the first day.
 */
export const ALERT_DAYS = 30;

/** The trail, newest first, with who did it and the notes on each entry. */
export async function listAuditWith(
  database: Database,
  filter: AuditFilter,
): Promise<AuditEntry[]> {
  const conditions = [
    filter.tenantSlugs === "all"
      ? undefined
      : inArray(auditLog.tenantSlug, filter.tenantSlugs),
    filter.actorId ? eq(auditLog.actorId, filter.actorId) : undefined,
    filter.from ? gte(auditLog.createdAt, filter.from) : undefined,
    filter.to ? lte(auditLog.createdAt, filter.to) : undefined,
    filter.ids?.length ? inArray(auditLog.id, filter.ids) : undefined,
    filter.levels?.length ? inArray(levelSql(), filter.levels) : undefined,
    filter.pending
      ? and(sql`${levelSql()} = 'urgente'`, isNull(auditReviews.id))
      : undefined,
    filter.includePlatform ? undefined : notByPlatform(),
    // An explicit list of ids (a notification, a report) ignores the archive.
    filter.ids?.length
      ? undefined
      : filter.archived
        ? isNotNull(auditReviews.archivedAt)
        : isNull(auditReviews.archivedAt),
    filter.excludeActorId
      ? or(
          isNull(auditLog.actorId),
          ne(auditLog.actorId, filter.excludeActorId),
        )
      : undefined,
    filter.text
      ? or(
          ilike(auditLog.action, `%${filter.text}%`),
          ilike(auditLog.targetId, `%${filter.text}%`),
        )
      : undefined,
  ].filter(Boolean);
  if (filter.tenantSlugs !== "all" && filter.tenantSlugs.length === 0)
    return [];
  const rows = await database
    .select({
      id: auditLog.id,
      tenantSlug: auditLog.tenantSlug,
      actorId: auditLog.actorId,
      actorName: user.name,
      actorRole: user.role,
      action: auditLog.action,
      targetType: auditLog.targetType,
      targetId: auditLog.targetId,
      reason: auditLog.reason,
      reviewedAt: auditReviews.reviewedAt,
      reviewedBy: auditReviews.reviewedBy,
      createdAt: auditLog.createdAt,
    })
    .from(auditLog)
    .leftJoin(user, eq(user.id, auditLog.actorId))
    .leftJoin(auditReviews, eq(auditReviews.auditId, auditLog.id))
    .where(and(...conditions))
    .orderBy(desc(auditLog.createdAt))
    .limit(filter.limit ?? 300);
  const ids = rows.map((row) => row.id);
  const notes = ids.length
    ? await database
        .select({
          id: auditNotes.id,
          auditId: auditNotes.auditId,
          body: auditNotes.body,
          createdAt: auditNotes.createdAt,
          editedAt: auditNotes.editedAt,
          authorName: user.name,
        })
        .from(auditNotes)
        .leftJoin(user, eq(user.id, auditNotes.authorId))
        .where(
          and(
            inArray(auditNotes.auditId, ids),
            isNull(auditNotes.removedAt),
            // A note of the Átrios account is as invisible as its acts.
            filter.includePlatform
              ? undefined
              : or(isNull(user.role), ne(user.role, "superadmin")),
          ),
        )
        .orderBy(auditNotes.createdAt)
    : [];
  // Targets that carry an account id ("user.update" on someone, a
  // notification to someone) read with the person's name instead.
  const accountIds = [
    ...new Set([
      ...rows.flatMap((row) => row.targetId?.match(ACCOUNT_ID) ?? []),
      ...rows.flatMap((row) => (row.reviewedBy ? [row.reviewedBy] : [])),
    ]),
  ];
  const names = new Map(
    accountIds.length
      ? (
          await database
            .select({ id: user.id, name: user.name })
            .from(user)
            .where(inArray(user.id, accountIds))
        ).map((person) => [person.id, person.name])
      : [],
  );
  return rows.map(({ reviewedBy, ...row }) => ({
    ...row,
    level: auditLevel(row.action),
    reviewerName: reviewedBy ? (names.get(reviewedBy) ?? null) : null,
    targetLabel:
      row.targetId?.replace(ACCOUNT_ID, (id) => names.get(id) ?? id) ?? null,
    notes: notes
      .filter((note) => note.auditId === row.id)
      .map(({ id, body, createdAt, editedAt, authorName }) => ({
        id,
        body,
        createdAt,
        editedAt,
        authorName,
      })),
  }));
}

/** A note of the Tabelião/Registrador on one entry; the entry never changes. */
export async function addAuditNoteWith(
  database: Database,
  tenantSlug: string,
  auditId: string,
  body: string,
  authorId: string,
): Promise<boolean> {
  const text = typed(body).slice(0, 2000);
  if (!text) return false;
  const [entry] = await database
    .select({ id: auditLog.id, tenantSlug: auditLog.tenantSlug })
    .from(auditLog)
    .where(eq(auditLog.id, auditId))
    .limit(1);
  if (!entry) return false;
  // The Átrios account notes on any office's trail; an office, on its own.
  if (tenantSlug !== "*" && entry.tenantSlug !== tenantSlug) return false;
  await database.insert(auditNotes).values({
    tenantSlug: entry.tenantSlug,
    auditId,
    authorId,
    body: text,
  });
  return true;
}

/** Marks urgent entries as seen by the holder; the panel's alert for them ends. */
export async function markReviewedWith(
  database: Database,
  tenantSlugs: string[] | "all",
  ids: string[],
  reviewerId: string,
  now = new Date(),
): Promise<number> {
  const wanted = ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 300);
  if (!wanted.length) return 0;
  if (tenantSlugs !== "all" && !tenantSlugs.length) return 0;
  const entries = await database
    .select({ id: auditLog.id, tenantSlug: auditLog.tenantSlug })
    .from(auditLog)
    .where(
      and(
        inArray(auditLog.id, wanted),
        tenantSlugs === "all"
          ? undefined
          : inArray(auditLog.tenantSlug, tenantSlugs),
      ),
    );
  if (!entries.length) return 0;
  const inserted = await database
    .insert(auditReviews)
    .values(
      entries.map((entry) => ({
        tenantSlug: entry.tenantSlug,
        auditId: entry.id,
        reviewedBy: reviewerId,
        reviewedAt: now,
      })),
    )
    .onConflictDoNothing()
    .returning({ id: auditReviews.id });
  return inserted.length;
}

/**
 * Archives entries, or brings them back (decision of 11/11/2026): the
 * holder's "excluir" for the trail, which never erases. An archived entry
 * leaves the list and the alerts, and counts as seen.
 */
export async function setArchivedWith(
  database: Database,
  tenantSlugs: string[] | "all",
  ids: string[],
  userId: string,
  archived: boolean,
  now = new Date(),
): Promise<number> {
  const wanted = ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 300);
  if (!wanted.length) return 0;
  if (tenantSlugs !== "all" && !tenantSlugs.length) return 0;
  // Seen first: an archived act is an act someone looked at.
  await markReviewedWith(database, tenantSlugs, wanted, userId, now);
  const changed = await database
    .update(auditReviews)
    .set(
      archived
        ? { archivedAt: now, archivedBy: userId }
        : { archivedAt: null, archivedBy: null },
    )
    .where(
      and(
        inArray(auditReviews.auditId, wanted),
        tenantSlugs === "all"
          ? undefined
          : inArray(auditReviews.tenantSlug, tenantSlugs),
      ),
    )
    .returning({ id: auditReviews.id });
  return changed.length;
}

/**
 * Urgent acts of the last 30 days nobody has marked as seen, by others than
 * the viewer: the alert on the holder's panel.
 */
export async function pendingUrgentCountWith(
  database: Database,
  tenantSlug: string,
  viewerId: string,
  now = new Date(),
): Promise<number> {
  const since = new Date(now.getTime() - ALERT_DAYS * 24 * 60 * 60 * 1000);
  const [row] = await database
    .select({ total: count() })
    .from(auditLog)
    .leftJoin(auditReviews, eq(auditReviews.auditId, auditLog.id))
    .where(
      and(
        eq(auditLog.tenantSlug, tenantSlug),
        gte(auditLog.createdAt, since),
        sql`${levelSql()} = 'urgente'`,
        isNull(auditReviews.id),
        or(isNull(auditLog.actorId), ne(auditLog.actorId, viewerId)),
        notByPlatform(),
      ),
    );
  return Number(row?.total ?? 0);
}

export interface PersonSummary {
  actorId: string;
  name: string;
  role: string | null;
  tenantSlug: string;
  total: number;
  urgente: number;
  pendentes: number;
  atencao: number;
  analise: number;
  lastAt: Date;
}

/** Who did what, by band, since a date: the trail divided by person. */
export async function peopleSummaryWith(
  database: Database,
  tenantSlugs: string[] | "all",
  since: Date,
  includePlatform = false,
): Promise<PersonSummary[]> {
  if (tenantSlugs !== "all" && !tenantSlugs.length) return [];
  const level = levelSql();
  const rows = await database
    .select({
      actorId: auditLog.actorId,
      name: user.name,
      role: user.role,
      tenantSlug: user.tenantSlug,
      total: count(),
      urgente: sql<number>`count(*) filter (where ${level} = 'urgente')`,
      pendentes: sql<number>`count(*) filter (where ${level} = 'urgente' and ${auditReviews.id} is null)`,
      atencao: sql<number>`count(*) filter (where ${level} = 'atencao')`,
      analise: sql<number>`count(*) filter (where ${level} = 'analise')`,
      lastAt: sql<string>`max(${auditLog.createdAt})`,
    })
    .from(auditLog)
    .innerJoin(user, eq(user.id, auditLog.actorId))
    .leftJoin(auditReviews, eq(auditReviews.auditId, auditLog.id))
    .where(
      and(
        tenantSlugs === "all"
          ? undefined
          : inArray(auditLog.tenantSlug, tenantSlugs),
        gte(auditLog.createdAt, since),
        includePlatform ? undefined : ne(user.role, "superadmin"),
      ),
    )
    .groupBy(auditLog.actorId, user.name, user.role, user.tenantSlug);
  return rows
    .map((row) => ({
      actorId: row.actorId ?? "",
      name: row.name,
      role: row.role,
      tenantSlug: row.tenantSlug,
      total: Number(row.total),
      urgente: Number(row.urgente),
      pendentes: Number(row.pendentes),
      atencao: Number(row.atencao),
      analise: Number(row.analise),
      lastAt: new Date(row.lastAt),
    }))
    .sort(
      (a, b) =>
        b.pendentes - a.pendentes ||
        b.urgente - a.urgente ||
        b.atencao - a.atencao ||
        b.lastAt.getTime() - a.lastAt.getTime(),
    );
}

/** The holder corrects a note. The act it hangs on never changes. */
export async function editAuditNoteWith(
  database: Database,
  tenantSlug: string | "*",
  noteId: string,
  body: string,
  now = new Date(),
): Promise<boolean> {
  const text = typed(body).slice(0, 2000);
  if (!text || !/^[0-9a-f-]{36}$/i.test(noteId)) return false;
  const [row] = await database
    .update(auditNotes)
    .set({ body: text, editedAt: now })
    .where(
      and(
        eq(auditNotes.id, noteId),
        isNull(auditNotes.removedAt),
        tenantSlug === "*" ? undefined : eq(auditNotes.tenantSlug, tenantSlug),
      ),
    )
    .returning({ id: auditNotes.id });
  return Boolean(row);
}

/**
 * "Excluir" a note: it leaves the screen and the reports; the row stays in
 * the database (nothing of the audit is ever erased).
 */
export async function removeAuditNoteWith(
  database: Database,
  tenantSlug: string | "*",
  noteId: string,
  userId: string,
  now = new Date(),
): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(noteId)) return false;
  const [row] = await database
    .update(auditNotes)
    .set({ removedAt: now, removedBy: userId })
    .where(
      and(
        eq(auditNotes.id, noteId),
        isNull(auditNotes.removedAt),
        tenantSlug === "*" ? undefined : eq(auditNotes.tenantSlug, tenantSlug),
      ),
    )
    .returning({ id: auditNotes.id });
  return Boolean(row);
}

/* ------------------------------------------------------- notifications */

export class NotificationError extends Error {}

export interface NotificationFile {
  storedName: string;
  displayName: string;
  path: string;
  mimeType: string;
  sizeBytes: number;
}

export interface NotificationInput {
  targetUserId: string;
  subject: string;
  facts: string;
  legalBasis: string;
  auditIds: string[];
  files?: NotificationFile[];
}

const ATTEMPTS = 5;

/** Issues the notification: next number of the year, 24 hours to answer. */
export async function createNotificationWith(
  database: Database,
  tenantSlug: string,
  input: NotificationInput,
  actorId: string,
  now = new Date(),
): Promise<{ id: string; year: number; sequence: number }> {
  const [target] = await database
    .select({ id: user.id })
    .from(user)
    .where(
      and(eq(user.id, input.targetUserId), eq(user.tenantSlug, tenantSlug)),
    )
    .limit(1);
  if (!target)
    throw new NotificationError("Pessoa não encontrada nesta serventia.");
  if (!input.subject.trim() || !input.facts.trim()) {
    throw new NotificationError("Informe o assunto e os fatos.");
  }
  const year = officeYear(now);
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const sequence = await nextNumberWith(
      database,
      tenantSlug,
      "notificacao",
      year,
    );
    try {
      const [row] = await database
        .insert(auditNotifications)
        .values({
          tenantSlug,
          year,
          sequence,
          targetUserId: input.targetUserId,
          createdBy: actorId,
          subject: typed(input.subject).replace(/\n+/g, " ").slice(0, 200),
          facts: typed(input.facts).slice(0, 8000),
          legalBasis: typed(input.legalBasis).slice(0, 8000),
          auditIds: input.auditIds.slice(0, 200),
          deadlineAt: new Date(now.getTime() + ANSWER_HOURS * 60 * 60 * 1000),
          createdAt: now,
        })
        .returning({ id: auditNotifications.id });
      if (input.files?.length) {
        await addNotificationFilesWith(
          database,
          tenantSlug,
          row.id,
          "titular",
          input.files,
          actorId,
        );
      }
      await recordAuditWith(database, {
        tenantSlug,
        actorId,
        action: "audit.notification",
        targetType: "audit-notification",
        targetId: `nº ${formatGuideNumber(year, sequence)} · ${input.targetUserId}`,
      });
      return { id: row.id, year, sequence };
    } catch (error) {
      if (attempt === ATTEMPTS || !String(error).includes("unique"))
        throw error;
    }
  }
  throw new NotificationError("Não foi possível numerar a notificação.");
}

export async function addNotificationFilesWith(
  database: Database,
  tenantSlug: string,
  notificationId: string,
  side: "titular" | "notificado",
  files: NotificationFile[],
  uploadedBy: string,
): Promise<void> {
  if (!files.length) return;
  await database.insert(auditNotificationFiles).values(
    files.map((file) => ({
      notificationId,
      tenantSlug,
      side,
      displayName: file.displayName,
      storedName: file.storedName,
      path: file.path,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      uploadedBy,
    })),
  );
}

export interface NotificationView {
  id: string;
  tenantSlug: string;
  year: number;
  sequence: number;
  targetUserId: string;
  targetName: string | null;
  targetEmail: string | null;
  targetRole: string | null;
  createdBy: string | null;
  subject: string;
  facts: string;
  legalBasis: string;
  auditIds: string[];
  deadlineAt: Date;
  status: string;
  response: string | null;
  respondedAt: Date | null;
  closedAt: Date | null;
  closingNote: string | null;
  signedDocumentId: string | null;
  emailedAt: Date | null;
  createdAt: Date;
  files: {
    id: string;
    side: string;
    displayName: string;
    mimeType: string;
    sizeBytes: number;
    path: string;
  }[];
}

async function viewsOf(
  database: Database,
  rows: (typeof auditNotifications.$inferSelect)[],
): Promise<NotificationView[]> {
  if (!rows.length) return [];
  const people = await database
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    })
    .from(user)
    .where(inArray(user.id, [...new Set(rows.map((row) => row.targetUserId))]));
  const files = await database
    .select()
    .from(auditNotificationFiles)
    .where(
      inArray(
        auditNotificationFiles.notificationId,
        rows.map((row) => row.id),
      ),
    )
    .orderBy(auditNotificationFiles.createdAt);
  return rows.map((row) => {
    const person = people.find((p) => p.id === row.targetUserId);
    return {
      ...row,
      auditIds: Array.isArray(row.auditIds) ? (row.auditIds as string[]) : [],
      targetName: person?.name ?? null,
      targetEmail: person?.email ?? null,
      targetRole: person?.role ?? null,
      files: files
        .filter((file) => file.notificationId === row.id)
        .map(({ id, side, displayName, mimeType, sizeBytes, path }) => ({
          id,
          side,
          displayName,
          mimeType,
          sizeBytes,
          path,
        })),
    };
  });
}

/** The office's notifications, or only one person's. */
export async function listNotificationsWith(
  database: Database,
  tenantSlug: string,
  targetUserId?: string,
): Promise<NotificationView[]> {
  const rows = await database
    .select()
    .from(auditNotifications)
    .where(
      and(
        eq(auditNotifications.tenantSlug, tenantSlug),
        targetUserId
          ? eq(auditNotifications.targetUserId, targetUserId)
          : undefined,
      ),
    )
    .orderBy(desc(auditNotifications.createdAt))
    .limit(300);
  return viewsOf(database, rows);
}

export async function findNotificationWith(
  database: Database,
  tenantSlug: string,
  id: string,
): Promise<NotificationView | undefined> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return undefined;
  const rows = await database
    .select()
    .from(auditNotifications)
    .where(
      and(
        eq(auditNotifications.tenantSlug, tenantSlug),
        eq(auditNotifications.id, id),
      ),
    )
    .limit(1);
  return (await viewsOf(database, rows))[0];
}

/** The notified person's answer, theirs alone, once. */
export async function answerNotificationWith(
  database: Database,
  tenantSlug: string,
  id: string,
  userId: string,
  response: string,
  files: NotificationFile[],
  now = new Date(),
): Promise<void> {
  const text = typed(response).slice(0, 8000);
  if (!text) throw new NotificationError("Escreva a sua resposta.");
  const notification = await findNotificationWith(database, tenantSlug, id);
  if (!notification || notification.targetUserId !== userId) {
    throw new NotificationError("Notificação não encontrada.");
  }
  if (notification.status !== "aberta") {
    throw new NotificationError(
      "Esta notificação já foi respondida ou encerrada.",
    );
  }
  await database
    .update(auditNotifications)
    .set({ response: text, respondedAt: now, status: "respondida" })
    .where(eq(auditNotifications.id, id));
  await addNotificationFilesWith(
    database,
    tenantSlug,
    id,
    "notificado",
    files,
    userId,
  );
  await recordAuditWith(database, {
    tenantSlug,
    actorId: userId,
    action: "audit.notification-answer",
    targetType: "audit-notification",
    targetId: `nº ${formatGuideNumber(notification.year, notification.sequence)}`,
  });
}

/** Closes it, with the Tabelião's conclusion. */
export async function closeNotificationWith(
  database: Database,
  tenantSlug: string,
  id: string,
  note: string,
  actorId: string,
  now = new Date(),
): Promise<boolean> {
  const [row] = await database
    .update(auditNotifications)
    .set({
      status: "encerrada",
      closedAt: now,
      closingNote: typed(note).slice(0, 4000) || null,
    })
    .where(
      and(
        eq(auditNotifications.tenantSlug, tenantSlug),
        eq(auditNotifications.id, id),
      ),
    )
    .returning({
      year: auditNotifications.year,
      sequence: auditNotifications.sequence,
    });
  if (!row) return false;
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "audit.notification-close",
    targetType: "audit-notification",
    targetId: `nº ${formatGuideNumber(row.year, row.sequence)}`,
  });
  return true;
}

export async function setNotificationSignedWith(
  database: Database,
  tenantSlug: string,
  id: string,
  signedDocumentId: string,
): Promise<void> {
  await database
    .update(auditNotifications)
    .set({ signedDocumentId })
    .where(
      and(
        eq(auditNotifications.tenantSlug, tenantSlug),
        eq(auditNotifications.id, id),
      ),
    );
}

export async function markNotificationEmailedWith(
  database: Database,
  id: string,
  now = new Date(),
): Promise<void> {
  await database
    .update(auditNotifications)
    .set({ emailedAt: now })
    .where(eq(auditNotifications.id, id));
}

/** Open notifications of this person: the badge of their Auditoria item. */
export async function openNotificationCountWith(
  database: Database,
  tenantSlug: string,
  userId: string,
): Promise<number> {
  const rows = await database
    .select({ id: auditNotifications.id })
    .from(auditNotifications)
    .where(
      and(
        eq(auditNotifications.tenantSlug, tenantSlug),
        eq(auditNotifications.targetUserId, userId),
        eq(auditNotifications.status, "aberta"),
      ),
    );
  return rows.length;
}
