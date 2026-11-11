import "server-only";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lte,
  ne,
  or,
} from "drizzle-orm";
import { PANEL_ROLES } from "@/core/auth/roles.ts";
import {
  AWAY_STATUSES,
  atLunch,
  canNudge,
  effectiveStatus,
  isColor,
  type Lunch,
  lingering,
  lunchLabel,
  MAX_TEXT,
  type MessageKind,
  type MessengerColor,
  type Presence,
  presenceOf,
  STATUS_ALERT_MINUTES,
  STATUS_LABELS,
  STATUS_RESET_MINUTES,
  STATUSES,
  type Status,
  validLunch,
} from "@/core/messages/rules.ts";
import { user } from "@/db/auth-schema.ts";
import type { Database } from "@/db/index.ts";
import {
  messengerConversations,
  messengerMembers,
  messengerMessages,
  messengerProfiles,
} from "@/db/schema.ts";
import { recordAuditWith } from "./audit.ts";

/* -------------------------------------------------------------- profile */

export interface Profile {
  userId: string;
  name: string;
  role: string;
  photo: boolean;
  status: Status;
  personalMessage: string;
  color: MessengerColor;
  sound: boolean;
  /** The approved daily lunch window, if any. */
  lunch: Lunch | null;
  /** A change waiting for the holder's decision. */
  lunchPending: Lunch | null;
  /** The holder turned this person's messenger off. */
  chatDisabled: boolean;
  /** Inside the lunch window and not back yet: the chat is locked. */
  atLunch: boolean;
  /** When the current status began (an away one lapses after 60 min). */
  statusChangedAt: Date | null;
}

export async function getProfileWith(
  database: Database,
  tenantSlug: string,
  userId: string,
): Promise<Profile | undefined> {
  const [row] = await database
    .select({
      userId: user.id,
      name: user.name,
      role: user.role,
      photoPath: messengerProfiles.photoPath,
      status: messengerProfiles.status,
      personalMessage: messengerProfiles.personalMessage,
      color: messengerProfiles.color,
      sound: messengerProfiles.sound,
      lunchStart: messengerProfiles.lunchStart,
      lunchMinutes: messengerProfiles.lunchMinutes,
      lunchPendingStart: messengerProfiles.lunchPendingStart,
      lunchPendingMinutes: messengerProfiles.lunchPendingMinutes,
      chatDisabledAt: messengerProfiles.chatDisabledAt,
      statusChangedAt: messengerProfiles.statusChangedAt,
      lunchReturnedAt: messengerProfiles.lunchReturnedAt,
    })
    .from(user)
    .leftJoin(messengerProfiles, eq(messengerProfiles.userId, user.id))
    .where(and(eq(user.id, userId), eq(user.tenantSlug, tenantSlug)))
    .limit(1);
  if (!row) return undefined;
  const now = new Date();
  const lunch = lunchOf(row.lunchStart, row.lunchMinutes);
  return {
    userId: row.userId,
    name: row.name,
    role: row.role ?? "",
    photo: Boolean(row.photoPath),
    status: effectiveStatus(row.status, row.statusChangedAt, now),
    personalMessage: row.personalMessage ?? "",
    color: isColor(row.color ?? "") ? (row.color as MessengerColor) : "verde",
    sound: row.sound ?? true,
    lunch,
    lunchPending: lunchOf(row.lunchPendingStart, row.lunchPendingMinutes),
    chatDisabled: Boolean(row.chatDisabledAt),
    atLunch: atLunch(lunch, row.lunchReturnedAt, now),
    statusChangedAt: row.statusChangedAt ?? null,
  };
}

function lunchOf(
  start: string | null | undefined,
  minutes: number | null | undefined,
): Lunch | null {
  return start && minutes ? { start, minutes } : null;
}

async function ensureProfile(
  database: Database,
  tenantSlug: string,
  userId: string,
): Promise<void> {
  await database
    .insert(messengerProfiles)
    .values({ userId, tenantSlug })
    .onConflictDoNothing();
}

export async function updateProfileWith(
  database: Database,
  tenantSlug: string,
  userId: string,
  input: {
    status?: string;
    personalMessage?: string;
    color?: string;
    sound?: boolean;
    photoPath?: string | null;
  },
  now = new Date(),
): Promise<void> {
  await ensureProfile(database, tenantSlug, userId);
  const [current] = await database
    .select({
      status: messengerProfiles.status,
      statusChangedAt: messengerProfiles.statusChangedAt,
    })
    .from(messengerProfiles)
    .where(eq(messengerProfiles.userId, userId))
    .limit(1);
  const valid =
    input.status && (STATUSES as readonly string[]).includes(input.status);
  // The clock restarts only when the status really changes: saving the
  // personal message again does not reset an away status's 60 minutes.
  // A status from before the clock existed starts it now.
  const changed =
    valid &&
    (input.status !==
      effectiveStatus(current?.status, current?.statusChangedAt, now) ||
      !current?.statusChangedAt);
  await database
    .update(messengerProfiles)
    .set({
      ...(valid ? { status: input.status } : {}),
      ...(changed ? { statusChangedAt: now } : {}),
      ...(input.personalMessage !== undefined
        ? { personalMessage: input.personalMessage.trim().slice(0, 140) }
        : {}),
      ...(input.color && isColor(input.color) ? { color: input.color } : {}),
      ...(input.sound !== undefined ? { sound: input.sound } : {}),
      ...(input.photoPath !== undefined ? { photoPath: input.photoPath } : {}),
      updatedAt: now,
    })
    .where(
      and(
        eq(messengerProfiles.userId, userId),
        eq(messengerProfiles.tenantSlug, tenantSlug),
      ),
    );
}

/** Seen now: what makes the person show as online to the others. */
export async function touchPresenceWith(
  database: Database,
  tenantSlug: string,
  userId: string,
  now = new Date(),
): Promise<void> {
  await database
    .insert(messengerProfiles)
    .values({ userId, tenantSlug, lastSeenAt: now })
    .onConflictDoUpdate({
      target: messengerProfiles.userId,
      set: { lastSeenAt: now },
    });
  // An away status past 60 minutes goes back to available for good.
  await database
    .update(messengerProfiles)
    .set({ status: "disponivel", statusChangedAt: now })
    .where(
      and(
        eq(messengerProfiles.userId, userId),
        inArray(messengerProfiles.status, [...AWAY_STATUSES]),
        lte(
          messengerProfiles.statusChangedAt,
          new Date(now.getTime() - STATUS_RESET_MINUTES * 60_000),
        ),
      ),
    );
}

/**
 * "Voltei do almoço / do descanso" (decision of 11/11/2026): unlocks the
 * chat inside today's window and shows the person as available.
 */
export async function returnFromLunchWith(
  database: Database,
  tenantSlug: string,
  userId: string,
  now = new Date(),
): Promise<void> {
  await ensureProfile(database, tenantSlug, userId);
  await database
    .update(messengerProfiles)
    .set({
      lunchReturnedAt: now,
      status: "disponivel",
      statusChangedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(messengerProfiles.userId, userId),
        eq(messengerProfiles.tenantSlug, tenantSlug),
      ),
    );
  await recordAuditWith(database, {
    tenantSlug,
    actorId: userId,
    action: "messenger.lunch-return",
    targetType: "user",
    targetId: userId,
  });
}

/** The holder changes someone's status (one that lingered, say). */
export async function setStatusByHolderWith(
  database: Database,
  tenantSlug: string,
  userId: string,
  status: string,
  holderId: string,
  now = new Date(),
): Promise<void> {
  if (!(STATUSES as readonly string[]).includes(status)) {
    throw new MessageError("Status inválido.");
  }
  const [member] = await database
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.id, userId), eq(user.tenantSlug, tenantSlug)))
    .limit(1);
  if (!member) throw new MessageError("Pessoa não encontrada.");
  await ensureProfile(database, tenantSlug, userId);
  await database
    .update(messengerProfiles)
    .set({ status, statusChangedAt: now, updatedAt: now })
    .where(eq(messengerProfiles.userId, userId));
  await recordAuditWith(database, {
    tenantSlug,
    actorId: holderId,
    action: "messenger.status-set",
    targetType: "user",
    targetId: userId,
    reason: `Status mudado para "${STATUS_LABELS[status as Status]}"`,
  });
}

export interface LingeringStatus {
  userId: string;
  name: string;
  status: Status;
  since: Date;
}

/**
 * Who has been away (busy, at the counter, in a meeting, absent) for 40
 * minutes or more, while online: the holder is told (decision of
 * 11/11/2026). Lunch is not counted.
 */
export async function lingeringStatusesWith(
  database: Database,
  tenantSlug: string,
  now = new Date(),
): Promise<LingeringStatus[]> {
  const rows = await database
    .select({
      userId: messengerProfiles.userId,
      name: user.name,
      status: messengerProfiles.status,
      since: messengerProfiles.statusChangedAt,
      lastSeenAt: messengerProfiles.lastSeenAt,
      lunchStart: messengerProfiles.lunchStart,
      lunchMinutes: messengerProfiles.lunchMinutes,
      lunchReturnedAt: messengerProfiles.lunchReturnedAt,
    })
    .from(messengerProfiles)
    .innerJoin(user, eq(user.id, messengerProfiles.userId))
    .where(
      and(
        eq(messengerProfiles.tenantSlug, tenantSlug),
        inArray(messengerProfiles.status, [...AWAY_STATUSES]),
        lte(
          messengerProfiles.statusChangedAt,
          new Date(now.getTime() - STATUS_ALERT_MINUTES * 60_000),
        ),
        isNull(user.disabledAt),
      ),
    );
  return rows
    .filter(
      (row) =>
        row.since &&
        lingering(row.status, row.since, now) &&
        presenceOf(
          row.status,
          row.lastSeenAt,
          now,
          lunchOf(row.lunchStart, row.lunchMinutes),
          { statusChangedAt: row.since, lunchReturnedAt: row.lunchReturnedAt },
        ) !== "offline" &&
        !atLunch(
          lunchOf(row.lunchStart, row.lunchMinutes),
          row.lunchReturnedAt,
          now,
        ),
    )
    .map((row) => ({
      userId: row.userId,
      name: row.name,
      status: row.status as Status,
      since: row.since as Date,
    }));
}

export async function photoPathOfWith(
  database: Database,
  tenantSlug: string,
  userId: string,
): Promise<string | null> {
  const [row] = await database
    .select({ photoPath: messengerProfiles.photoPath })
    .from(messengerProfiles)
    .where(
      and(
        eq(messengerProfiles.userId, userId),
        eq(messengerProfiles.tenantSlug, tenantSlug),
      ),
    )
    .limit(1);
  return row?.photoPath ?? null;
}

/* ------------------------------------------------------------- contacts */

export interface Contact {
  userId: string;
  name: string;
  role: string;
  photo: boolean;
  presence: Presence;
  personalMessage: string;
  conversationId: string | null;
  unread: number;
  lastMessageAt: Date | null;
}

const pairKeyOf = (a: string, b: string) => [a, b].sort().join(":");

/** Everyone of the office one can talk to, with presence and unread counts. */
export async function listContactsWith(
  database: Database,
  tenantSlug: string,
  viewerId: string,
  now = new Date(),
): Promise<Contact[]> {
  const people = await database
    .select({
      userId: user.id,
      name: user.name,
      role: user.role,
      photoPath: messengerProfiles.photoPath,
      status: messengerProfiles.status,
      personalMessage: messengerProfiles.personalMessage,
      lastSeenAt: messengerProfiles.lastSeenAt,
      lunchStart: messengerProfiles.lunchStart,
      lunchMinutes: messengerProfiles.lunchMinutes,
      statusChangedAt: messengerProfiles.statusChangedAt,
      lunchReturnedAt: messengerProfiles.lunchReturnedAt,
      chatDisabledAt: messengerProfiles.chatDisabledAt,
    })
    .from(user)
    .leftJoin(messengerProfiles, eq(messengerProfiles.userId, user.id))
    .where(
      and(
        eq(user.tenantSlug, tenantSlug),
        inArray(user.role, [...PANEL_ROLES]),
        isNull(user.disabledAt),
        ne(user.id, viewerId),
      ),
    )
    .orderBy(asc(user.name));
  const conversations = await database
    .select({
      id: messengerConversations.id,
      pairKey: messengerConversations.pairKey,
      lastMessageAt: messengerConversations.lastMessageAt,
      lastReadAt: messengerMembers.lastReadAt,
    })
    .from(messengerConversations)
    .innerJoin(
      messengerMembers,
      and(
        eq(messengerMembers.conversationId, messengerConversations.id),
        eq(messengerMembers.userId, viewerId),
      ),
    )
    .where(eq(messengerConversations.tenantSlug, tenantSlug));
  const unread = await unreadByConversation(database, viewerId);
  return people
    .map((person) => {
      const conversation = conversations.find(
        (c) => c.pairKey === pairKeyOf(viewerId, person.userId),
      );
      return {
        userId: person.userId,
        name: person.name,
        role: person.role ?? "",
        photo: Boolean(person.photoPath),
        presence: person.chatDisabledAt
          ? ("offline" as const)
          : presenceOf(
              person.status,
              person.lastSeenAt,
              now,
              lunchOf(person.lunchStart, person.lunchMinutes),
              {
                statusChangedAt: person.statusChangedAt,
                lunchReturnedAt: person.lunchReturnedAt,
              },
            ),
        personalMessage: person.personalMessage ?? "",
        conversationId: conversation?.id ?? null,
        unread: conversation ? (unread.get(conversation.id) ?? 0) : 0,
        lastMessageAt: conversation?.lastMessageAt ?? null,
      };
    })
    .sort(
      (a, b) =>
        b.unread - a.unread ||
        Number(b.presence !== "offline") - Number(a.presence !== "offline") ||
        (b.lastMessageAt?.getTime() ?? 0) - (a.lastMessageAt?.getTime() ?? 0) ||
        a.name.localeCompare(b.name),
    );
}

async function unreadByConversation(
  database: Database,
  userId: string,
): Promise<Map<string, number>> {
  const rows = await database
    .select({
      conversationId: messengerMessages.conversationId,
      total: count(),
    })
    .from(messengerMessages)
    .innerJoin(
      messengerMembers,
      and(
        eq(messengerMembers.conversationId, messengerMessages.conversationId),
        eq(messengerMembers.userId, userId),
      ),
    )
    .where(
      and(
        ne(messengerMessages.senderId, userId),
        isNull(messengerMessages.deletedAt),
        or(
          isNull(messengerMembers.lastReadAt),
          gt(messengerMessages.createdAt, messengerMembers.lastReadAt),
        ),
      ),
    )
    .groupBy(messengerMessages.conversationId);
  return new Map(rows.map((row) => [row.conversationId, Number(row.total)]));
}

/* -------------------------------------------------------- conversations */

export class MessageError extends Error {}

/** The one direct conversation between two people of the office. */
export async function openDirectWith(
  database: Database,
  tenantSlug: string,
  viewerId: string,
  otherId: string,
): Promise<string> {
  if (viewerId === otherId) {
    throw new MessageError("Escolha outra pessoa para conversar.");
  }
  const [other] = await database
    .select({ id: user.id })
    .from(user)
    .where(
      and(
        eq(user.id, otherId),
        eq(user.tenantSlug, tenantSlug),
        isNull(user.disabledAt),
      ),
    )
    .limit(1);
  if (!other) throw new MessageError("Pessoa não encontrada nesta serventia.");
  const [off] = await database
    .select({ at: messengerProfiles.chatDisabledAt })
    .from(messengerProfiles)
    .where(eq(messengerProfiles.userId, otherId))
    .limit(1);
  if (off?.at) {
    throw new MessageError(
      "O chat desta pessoa foi desativado pelo Tabelião/Registrador.",
    );
  }
  const pairKey = pairKeyOf(viewerId, otherId);
  await database
    .insert(messengerConversations)
    .values({ tenantSlug, pairKey, createdBy: viewerId })
    .onConflictDoNothing();
  const [conversation] = await database
    .select({ id: messengerConversations.id })
    .from(messengerConversations)
    .where(
      and(
        eq(messengerConversations.tenantSlug, tenantSlug),
        eq(messengerConversations.pairKey, pairKey),
      ),
    )
    .limit(1);
  await database
    .insert(messengerMembers)
    .values([
      { conversationId: conversation.id, userId: viewerId },
      { conversationId: conversation.id, userId: otherId },
    ])
    .onConflictDoNothing();
  return conversation.id;
}

export interface Viewer {
  id: string;
  /** The Tabelião/Registrador and the Átrios account: every conversation. */
  oversight: boolean;
}

export interface ConversationView {
  id: string;
  members: { userId: string; name: string; role: string; photo: boolean }[];
  /** Whether the viewer is in it (or only reading, as the holder). */
  member: boolean;
}

export async function findConversationWith(
  database: Database,
  tenantSlug: string,
  conversationId: string,
  viewer: Viewer,
): Promise<ConversationView | undefined> {
  if (!/^[0-9a-f-]{36}$/i.test(conversationId)) return undefined;
  const [conversation] = await database
    .select({ id: messengerConversations.id })
    .from(messengerConversations)
    .where(
      and(
        eq(messengerConversations.id, conversationId),
        eq(messengerConversations.tenantSlug, tenantSlug),
      ),
    )
    .limit(1);
  if (!conversation) return undefined;
  const members = await database
    .select({
      userId: messengerMembers.userId,
      name: user.name,
      role: user.role,
      photoPath: messengerProfiles.photoPath,
    })
    .from(messengerMembers)
    .innerJoin(user, eq(user.id, messengerMembers.userId))
    .leftJoin(messengerProfiles, eq(messengerProfiles.userId, user.id))
    .where(eq(messengerMembers.conversationId, conversationId));
  const member = members.some((m) => m.userId === viewer.id);
  if (!member && !viewer.oversight) return undefined;
  return {
    id: conversation.id,
    member,
    members: members.map((m) => ({
      userId: m.userId,
      name: m.name,
      role: m.role ?? "",
      photo: Boolean(m.photoPath),
    })),
  };
}

export interface MessageView {
  id: string;
  senderId: string;
  senderName: string;
  kind: MessageKind;
  body: string | null;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: Date;
  editedAt: Date | null;
  /** Deleted by its author: members see "Mensagem apagada", no content. */
  deleted: boolean;
  /** For the holder's oversight only: the text as first sent. */
  originalBody: string | null;
}

/**
 * The conversation's messages, oldest first. With `after`, only what was
 * sent, edited or deleted since then, so an open screen follows edits too.
 * A member does not see what they cleared, nor the content of a deleted
 * message; the holder's oversight (`full`) sees everything.
 */
export async function listMessagesWith(
  database: Database,
  tenantSlug: string,
  conversationId: string,
  viewer: Viewer,
  options: { after?: Date; limit?: number; full?: boolean } = {},
): Promise<MessageView[] | undefined> {
  const conversation = await findConversationWith(
    database,
    tenantSlug,
    conversationId,
    viewer,
  );
  if (!conversation) return undefined;
  const full = Boolean(options.full && viewer.oversight);
  // What this member cleared stays out of their view.
  const [membership] = conversation.member
    ? await database
        .select({ clearedAt: messengerMembers.clearedAt })
        .from(messengerMembers)
        .where(
          and(
            eq(messengerMembers.conversationId, conversationId),
            eq(messengerMembers.userId, viewer.id),
          ),
        )
        .limit(1)
    : [];
  const cleared = full ? null : (membership?.clearedAt ?? null);
  const rows = await database
    .select({
      id: messengerMessages.id,
      senderId: messengerMessages.senderId,
      senderName: user.name,
      kind: messengerMessages.kind,
      body: messengerMessages.body,
      fileName: messengerMessages.fileName,
      mimeType: messengerMessages.mimeType,
      sizeBytes: messengerMessages.sizeBytes,
      createdAt: messengerMessages.createdAt,
      editedAt: messengerMessages.editedAt,
      originalBody: messengerMessages.originalBody,
      deletedAt: messengerMessages.deletedAt,
    })
    .from(messengerMessages)
    .leftJoin(user, eq(user.id, messengerMessages.senderId))
    .where(
      and(
        eq(messengerMessages.conversationId, conversationId),
        cleared ? gt(messengerMessages.createdAt, cleared) : undefined,
        options.after
          ? or(
              gt(messengerMessages.createdAt, options.after),
              gt(messengerMessages.editedAt, options.after),
              gt(messengerMessages.deletedAt, options.after),
            )
          : undefined,
      ),
    )
    .orderBy(desc(messengerMessages.createdAt))
    .limit(options.limit ?? 200);
  return rows.reverse().map(({ deletedAt, originalBody, ...row }) => {
    const deleted = Boolean(deletedAt);
    const hide = deleted && !full;
    return {
      ...row,
      senderName: row.senderName ?? "Conta removida",
      kind: row.kind as MessageKind,
      body: hide ? null : row.body,
      fileName: hide ? null : row.fileName,
      deleted,
      originalBody: full ? originalBody : null,
    };
  });
}

/** Up to when this member's view of the conversation was cleared. */
export async function clearedAtWith(
  database: Database,
  conversationId: string,
  userId: string,
): Promise<Date | null> {
  if (!/^[0-9a-f-]{36}$/i.test(conversationId)) return null;
  const [row] = await database
    .select({ clearedAt: messengerMembers.clearedAt })
    .from(messengerMembers)
    .where(
      and(
        eq(messengerMembers.conversationId, conversationId),
        eq(messengerMembers.userId, userId),
      ),
    )
    .limit(1);
  return row?.clearedAt ?? null;
}

/** Its author corrects a text; the first version stays for the holder. */
export async function editMessageWith(
  database: Database,
  tenantSlug: string,
  messageId: string,
  userId: string,
  body: string,
  now = new Date(),
): Promise<void> {
  const text = body.replace(/\r\n?/g, "\n").trim().slice(0, MAX_TEXT);
  if (!text) throw new MessageError("Escreva a mensagem.");
  const [row] = await database
    .select({
      kind: messengerMessages.kind,
      body: messengerMessages.body,
      originalBody: messengerMessages.originalBody,
      deletedAt: messengerMessages.deletedAt,
      conversationId: messengerMessages.conversationId,
    })
    .from(messengerMessages)
    .where(
      and(
        eq(messengerMessages.id, messageId),
        eq(messengerMessages.tenantSlug, tenantSlug),
        eq(messengerMessages.senderId, userId),
      ),
    )
    .limit(1);
  if (!row || row.deletedAt || row.kind !== "texto") {
    throw new MessageError("Só dá para editar as suas mensagens de texto.");
  }
  await database
    .update(messengerMessages)
    .set({
      body: text,
      editedAt: now,
      originalBody: row.originalBody ?? row.body,
    })
    .where(eq(messengerMessages.id, messageId));
  await recordAuditWith(database, {
    tenantSlug,
    actorId: userId,
    action: "messenger.message-edit",
    targetType: "messenger-conversation",
    targetId: row.conversationId,
  });
}

/**
 * Its author "apaga" a message: it leaves the conversation for everyone,
 * and stays in the database for the holder's oversight.
 */
export async function deleteMessageWith(
  database: Database,
  tenantSlug: string,
  messageId: string,
  userId: string,
  now = new Date(),
): Promise<void> {
  const [row] = await database
    .update(messengerMessages)
    .set({ deletedAt: now, deletedBy: userId })
    .where(
      and(
        eq(messengerMessages.id, messageId),
        eq(messengerMessages.tenantSlug, tenantSlug),
        eq(messengerMessages.senderId, userId),
        isNull(messengerMessages.deletedAt),
      ),
    )
    .returning({ conversationId: messengerMessages.conversationId });
  if (!row) throw new MessageError("Só dá para apagar as suas mensagens.");
  await recordAuditWith(database, {
    tenantSlug,
    actorId: userId,
    action: "messenger.message-delete",
    targetType: "messenger-conversation",
    targetId: row.conversationId,
  });
}

/**
 * "Limpar conversa": from now back, gone from the conversation for both
 * members (decision of 11/11/2026). Nothing is erased: the holder's
 * oversight still reads it all.
 */
export async function clearConversationWith(
  database: Database,
  tenantSlug: string,
  conversationId: string,
  userId: string,
  now = new Date(),
): Promise<void> {
  const conversation = await findConversationWith(
    database,
    tenantSlug,
    conversationId,
    { id: userId, oversight: false },
  );
  if (!conversation?.member) throw new MessageError("Conversa não encontrada.");
  await database
    .update(messengerMembers)
    .set({ clearedAt: now })
    .where(eq(messengerMembers.conversationId, conversationId));
  await database
    .update(messengerMembers)
    .set({ lastReadAt: now })
    .where(
      and(
        eq(messengerMembers.conversationId, conversationId),
        eq(messengerMembers.userId, userId),
      ),
    );
  await recordAuditWith(database, {
    tenantSlug,
    actorId: userId,
    action: "messenger.conversation-clear",
    targetType: "messenger-conversation",
    targetId: conversationId,
  });
}

export interface OutgoingFile {
  path: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
}

/** Sends, as a member only. "Chamar atenção" waits its cooldown. */
export async function sendMessageWith(
  database: Database,
  tenantSlug: string,
  conversationId: string,
  senderId: string,
  input:
    | { kind: "texto"; body: string }
    | { kind: "arquivo" | "audio"; file: OutgoingFile; body?: string }
    | { kind: "chamar" },
  now = new Date(),
): Promise<string> {
  const conversation = await findConversationWith(
    database,
    tenantSlug,
    conversationId,
    { id: senderId, oversight: false },
  );
  if (!conversation?.member) {
    throw new MessageError("Conversa não encontrada.");
  }
  let body: string | null = null;
  if (input.kind === "texto") {
    body = input.body.replace(/\r\n?/g, "\n").trim().slice(0, MAX_TEXT);
    if (!body) throw new MessageError("Escreva a mensagem.");
  }
  if (input.kind === "chamar") {
    const [last] = await database
      .select({ at: messengerMessages.createdAt })
      .from(messengerMessages)
      .where(
        and(
          eq(messengerMessages.conversationId, conversationId),
          eq(messengerMessages.senderId, senderId),
          eq(messengerMessages.kind, "chamar"),
        ),
      )
      .orderBy(desc(messengerMessages.createdAt))
      .limit(1);
    if (!canNudge(last?.at ?? null, now)) {
      throw new MessageError(
        "Você acabou de chamar a atenção. Aguarde alguns segundos.",
      );
    }
  }
  const file =
    input.kind === "arquivo" || input.kind === "audio" ? input.file : undefined;
  const [row] = await database
    .insert(messengerMessages)
    .values({
      conversationId,
      tenantSlug,
      senderId,
      kind: input.kind,
      body:
        body ??
        (input.kind !== "chamar" && "body" in input && input.body
          ? input.body.trim().slice(0, MAX_TEXT)
          : null),
      filePath: file?.path ?? null,
      fileName: file?.name.slice(0, 200) ?? null,
      mimeType: file?.mimeType ?? null,
      sizeBytes: file?.sizeBytes ?? null,
      createdAt: now,
    })
    .returning({ id: messengerMessages.id });
  await database
    .update(messengerConversations)
    .set({ lastMessageAt: now })
    .where(eq(messengerConversations.id, conversationId));
  await markReadWith(database, conversationId, senderId, now);
  return row.id;
}

export async function markReadWith(
  database: Database,
  conversationId: string,
  userId: string,
  now = new Date(),
): Promise<void> {
  await database
    .update(messengerMembers)
    .set({ lastReadAt: now })
    .where(
      and(
        eq(messengerMembers.conversationId, conversationId),
        eq(messengerMembers.userId, userId),
      ),
    );
}

export interface Incoming {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  kind: MessageKind;
  preview: string;
  createdAt: Date;
}

/**
 * What reached this person since `since`, from others: what the panel's
 * watcher rings, pops up and shakes for. Plus the total unread.
 */
export async function inboxWith(
  database: Database,
  userId: string,
  since: Date,
): Promise<{
  incoming: Incoming[];
  unread: number;
  latest: Incoming | null;
}> {
  const rows = await database
    .select({
      id: messengerMessages.id,
      conversationId: messengerMessages.conversationId,
      senderId: messengerMessages.senderId,
      senderName: user.name,
      kind: messengerMessages.kind,
      body: messengerMessages.body,
      fileName: messengerMessages.fileName,
      createdAt: messengerMessages.createdAt,
    })
    .from(messengerMessages)
    .innerJoin(
      messengerMembers,
      and(
        eq(messengerMembers.conversationId, messengerMessages.conversationId),
        eq(messengerMembers.userId, userId),
      ),
    )
    .leftJoin(user, eq(user.id, messengerMessages.senderId))
    .where(
      and(
        ne(messengerMessages.senderId, userId),
        gt(messengerMessages.createdAt, since),
      ),
    )
    .orderBy(asc(messengerMessages.createdAt))
    .limit(20);
  const unread = [
    ...(await unreadByConversation(database, userId)).values(),
  ].reduce((sum, n) => sum + n, 0);
  // The newest message still unread, whenever it came: what the floating
  // balloon offers to answer, also right after a page load.
  const [newest] = unread
    ? await database
        .select({
          id: messengerMessages.id,
          conversationId: messengerMessages.conversationId,
          senderId: messengerMessages.senderId,
          senderName: user.name,
          kind: messengerMessages.kind,
          body: messengerMessages.body,
          fileName: messengerMessages.fileName,
          createdAt: messengerMessages.createdAt,
        })
        .from(messengerMessages)
        .innerJoin(
          messengerMembers,
          and(
            eq(
              messengerMembers.conversationId,
              messengerMessages.conversationId,
            ),
            eq(messengerMembers.userId, userId),
          ),
        )
        .leftJoin(user, eq(user.id, messengerMessages.senderId))
        .where(
          and(
            ne(messengerMessages.senderId, userId),
            or(
              isNull(messengerMembers.lastReadAt),
              gt(messengerMessages.createdAt, messengerMembers.lastReadAt),
            ),
          ),
        )
        .orderBy(desc(messengerMessages.createdAt))
        .limit(1)
    : [];
  const preview = (row: {
    kind: string;
    body: string | null;
    fileName: string | null;
  }) =>
    row.kind === "chamar"
      ? "chamou a sua atenção!"
      : row.kind === "audio"
        ? "enviou um áudio"
        : row.kind === "arquivo"
          ? `enviou ${row.fileName ?? "um arquivo"}`
          : (row.body ?? "").slice(0, 120);
  return {
    unread,
    latest: newest
      ? {
          id: newest.id,
          conversationId: newest.conversationId,
          senderId: newest.senderId,
          senderName: newest.senderName ?? "Alguém",
          kind: newest.kind as MessageKind,
          createdAt: newest.createdAt,
          preview: preview(newest),
        }
      : null,
    incoming: rows.map((row) => ({
      id: row.id,
      conversationId: row.conversationId,
      senderId: row.senderId,
      senderName: row.senderName ?? "Alguém",
      kind: row.kind as MessageKind,
      createdAt: row.createdAt,
      preview:
        row.kind === "chamar"
          ? "chamou a sua atenção!"
          : row.kind === "audio"
            ? "enviou um áudio"
            : row.kind === "arquivo"
              ? `enviou ${row.fileName ?? "um arquivo"}`
              : (row.body ?? "").slice(0, 120),
    })),
  };
}

export interface OversightRow {
  id: string;
  members: string[];
  messages: number;
  lastMessageAt: Date | null;
}

/** Every conversation of the office, for the Tabelião/Registrador. */
export async function listAllConversationsWith(
  database: Database,
  tenantSlug: string,
): Promise<OversightRow[]> {
  const conversations = await database
    .select({
      id: messengerConversations.id,
      lastMessageAt: messengerConversations.lastMessageAt,
      messages: count(messengerMessages.id),
    })
    .from(messengerConversations)
    .leftJoin(
      messengerMessages,
      eq(messengerMessages.conversationId, messengerConversations.id),
    )
    .where(eq(messengerConversations.tenantSlug, tenantSlug))
    .groupBy(messengerConversations.id, messengerConversations.lastMessageAt)
    .orderBy(desc(messengerConversations.lastMessageAt))
    .limit(300);
  if (!conversations.length) return [];
  const members = await database
    .select({
      conversationId: messengerMembers.conversationId,
      name: user.name,
    })
    .from(messengerMembers)
    .innerJoin(user, eq(user.id, messengerMembers.userId))
    .where(
      inArray(
        messengerMembers.conversationId,
        conversations.map((c) => c.id),
      ),
    );
  return conversations
    .filter((c) => Number(c.messages) > 0)
    .map((c) => ({
      id: c.id,
      lastMessageAt: c.lastMessageAt,
      messages: Number(c.messages),
      members: members
        .filter((m) => m.conversationId === c.id)
        .map((m) => m.name)
        .sort(),
    }));
}

/** A message's file, for whoever may read the conversation. */
export async function findMessageFileWith(
  database: Database,
  tenantSlug: string,
  messageId: string,
  viewer: Viewer,
): Promise<{ path: string; name: string; mimeType: string } | undefined> {
  if (!/^[0-9a-f-]{36}$/i.test(messageId)) return undefined;
  const [row] = await database
    .select({
      conversationId: messengerMessages.conversationId,
      path: messengerMessages.filePath,
      name: messengerMessages.fileName,
      mimeType: messengerMessages.mimeType,
      deletedAt: messengerMessages.deletedAt,
    })
    .from(messengerMessages)
    .where(
      and(
        eq(messengerMessages.id, messageId),
        eq(messengerMessages.tenantSlug, tenantSlug),
      ),
    )
    .limit(1);
  if (!row?.path) return undefined;
  // A deleted file no longer opens in the chat; the holder still reads it.
  if (row.deletedAt && !viewer.oversight) return undefined;
  const conversation = await findConversationWith(
    database,
    tenantSlug,
    row.conversationId,
    viewer,
  );
  if (!conversation) return undefined;
  return {
    path: row.path,
    name: row.name ?? "arquivo",
    mimeType: row.mimeType ?? "application/octet-stream",
  };
}

/* ------------------------------------------------- lunch and the holder */

/**
 * Asks for a daily lunch window (or a change of it): it waits for the
 * Tabelião/Registrador's decision, goes to the audit, and cannot be asked
 * again while it waits (decision of 11/11/2026).
 */
export async function requestLunchWith(
  database: Database,
  tenantSlug: string,
  userId: string,
  start: string,
  minutes: number,
  now = new Date(),
): Promise<void> {
  const problem = validLunch(start, minutes);
  if (problem) throw new MessageError(problem);
  await ensureProfile(database, tenantSlug, userId);
  const [row] = await database
    .select({ pending: messengerProfiles.lunchPendingStart })
    .from(messengerProfiles)
    .where(eq(messengerProfiles.userId, userId))
    .limit(1);
  if (row?.pending) {
    throw new MessageError(
      "Já existe um pedido de horário de almoço esperando o Tabelião/Registrador. Ele não pode ser mudado até a decisão.",
    );
  }
  await database
    .update(messengerProfiles)
    .set({
      lunchPendingStart: start,
      lunchPendingMinutes: minutes,
      lunchRequestedAt: now,
    })
    .where(eq(messengerProfiles.userId, userId));
  await recordAuditWith(database, {
    tenantSlug,
    actorId: userId,
    action: "messenger.lunch-request",
    targetType: "user",
    targetId: `${lunchLabel({ start, minutes })} · ${userId}`,
  });
}

/** The holder's yes or no to a lunch window asked for. */
export async function decideLunchWith(
  database: Database,
  tenantSlug: string,
  userId: string,
  approve: boolean,
  holderId: string,
): Promise<boolean> {
  const [row] = await database
    .select({
      start: messengerProfiles.lunchPendingStart,
      minutes: messengerProfiles.lunchPendingMinutes,
    })
    .from(messengerProfiles)
    .where(
      and(
        eq(messengerProfiles.userId, userId),
        eq(messengerProfiles.tenantSlug, tenantSlug),
      ),
    )
    .limit(1);
  if (!row?.start || !row.minutes) return false;
  await database
    .update(messengerProfiles)
    .set({
      ...(approve ? { lunchStart: row.start, lunchMinutes: row.minutes } : {}),
      lunchPendingStart: null,
      lunchPendingMinutes: null,
      lunchRequestedAt: null,
    })
    .where(eq(messengerProfiles.userId, userId));
  await recordAuditWith(database, {
    tenantSlug,
    actorId: holderId,
    action: approve ? "messenger.lunch-approve" : "messenger.lunch-reject",
    targetType: "user",
    targetId: `${lunchLabel({ start: row.start, minutes: row.minutes })} · ${userId}`,
  });
  return true;
}

/** The holder turns one person's messenger off, or back on. */
export async function setChatDisabledWith(
  database: Database,
  tenantSlug: string,
  userId: string,
  disabled: boolean,
  holderId: string,
  now = new Date(),
): Promise<void> {
  await ensureProfile(database, tenantSlug, userId);
  await database
    .update(messengerProfiles)
    .set(
      disabled
        ? { chatDisabledAt: now, chatDisabledBy: holderId }
        : { chatDisabledAt: null, chatDisabledBy: null },
    )
    .where(
      and(
        eq(messengerProfiles.userId, userId),
        eq(messengerProfiles.tenantSlug, tenantSlug),
      ),
    );
  await recordAuditWith(database, {
    tenantSlug,
    actorId: holderId,
    action: disabled ? "messenger.chat-off" : "messenger.chat-on",
    targetType: "user",
    targetId: userId,
  });
}

export interface TeamRow {
  userId: string;
  name: string;
  role: string;
  lunch: Lunch | null;
  lunchPending: Lunch | null;
  lunchRequestedAt: Date | null;
  chatDisabled: boolean;
  /** What the others see now, and since when the status stands. */
  presence: Presence;
  status: Status;
  statusSince: Date | null;
  /** Away for 40 minutes or more: the holder was told. */
  lingering: boolean;
}

/** The office's people, for the holder's panel of lunch and chat. */
export async function listTeamWith(
  database: Database,
  tenantSlug: string,
  now = new Date(),
): Promise<TeamRow[]> {
  const rows = await database
    .select({
      userId: user.id,
      name: user.name,
      role: user.role,
      lunchStart: messengerProfiles.lunchStart,
      lunchMinutes: messengerProfiles.lunchMinutes,
      lunchPendingStart: messengerProfiles.lunchPendingStart,
      lunchPendingMinutes: messengerProfiles.lunchPendingMinutes,
      lunchRequestedAt: messengerProfiles.lunchRequestedAt,
      chatDisabledAt: messengerProfiles.chatDisabledAt,
      status: messengerProfiles.status,
      statusChangedAt: messengerProfiles.statusChangedAt,
      lunchReturnedAt: messengerProfiles.lunchReturnedAt,
      lastSeenAt: messengerProfiles.lastSeenAt,
    })
    .from(user)
    .leftJoin(messengerProfiles, eq(messengerProfiles.userId, user.id))
    .where(
      and(
        eq(user.tenantSlug, tenantSlug),
        inArray(user.role, [...PANEL_ROLES]),
        isNull(user.disabledAt),
      ),
    )
    .orderBy(asc(user.name));
  return rows.map((row) => ({
    userId: row.userId,
    name: row.name,
    role: row.role ?? "",
    lunch: lunchOf(row.lunchStart, row.lunchMinutes),
    lunchPending: lunchOf(row.lunchPendingStart, row.lunchPendingMinutes),
    lunchRequestedAt: row.lunchRequestedAt,
    chatDisabled: Boolean(row.chatDisabledAt),
    presence: row.chatDisabledAt
      ? "offline"
      : presenceOf(
          row.status,
          row.lastSeenAt,
          now,
          lunchOf(row.lunchStart, row.lunchMinutes),
          {
            statusChangedAt: row.statusChangedAt,
            lunchReturnedAt: row.lunchReturnedAt,
          },
        ),
    status: effectiveStatus(row.status, row.statusChangedAt, now),
    statusSince: row.statusChangedAt,
    lingering:
      lingering(row.status, row.statusChangedAt, now) &&
      !atLunch(
        lunchOf(row.lunchStart, row.lunchMinutes),
        row.lunchReturnedAt,
        now,
      ),
  }));
}
