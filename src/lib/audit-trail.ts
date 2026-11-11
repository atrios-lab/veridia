import "server-only";
import { and, desc, eq, gte, ilike, inArray, lte, or } from "drizzle-orm";
import { ANSWER_HOURS } from "@/core/audit/labels.ts";
import { formatGuideNumber } from "@/core/guides/schema.ts";
import { officeYear } from "@/core/time/office-time.ts";
import { user } from "@/db/auth-schema.ts";
import type { Database } from "@/db/index.ts";
import {
  auditLog,
  auditNotes,
  auditNotificationFiles,
  auditNotifications,
} from "@/db/schema.ts";
import { recordAuditWith } from "./audit.ts";
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
  createdAt: Date;
  notes: {
    id: string;
    body: string;
    createdAt: Date;
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
  limit?: number;
}

const ACCOUNT_ID = /\b[A-Za-z0-9]{32}\b/g;

/** What a form sent, with the browser's CRLF turned into plain newlines. */
const typed = (text: string) => text.replace(/\r\n?/g, "\n").trim();

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
      createdAt: auditLog.createdAt,
    })
    .from(auditLog)
    .leftJoin(user, eq(user.id, auditLog.actorId))
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
          authorName: user.name,
        })
        .from(auditNotes)
        .leftJoin(user, eq(user.id, auditNotes.authorId))
        .where(inArray(auditNotes.auditId, ids))
        .orderBy(auditNotes.createdAt)
    : [];
  // Targets that carry an account id ("user.update" on someone, a
  // notification to someone) read with the person's name instead.
  const accountIds = [
    ...new Set(rows.flatMap((row) => row.targetId?.match(ACCOUNT_ID) ?? [])),
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
  return rows.map((row) => ({
    ...row,
    targetLabel:
      row.targetId?.replace(ACCOUNT_ID, (id) => names.get(id) ?? id) ?? null,
    notes: notes
      .filter((note) => note.auditId === row.id)
      .map(({ id, body, createdAt, authorName }) => ({
        id,
        body,
        createdAt,
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
