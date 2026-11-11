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
  ne,
  or,
} from "drizzle-orm";
import { PANEL_ROLES } from "@/core/auth/roles.ts";
import {
  canNudge,
  isColor,
  MAX_TEXT,
  type MessageKind,
  type MessengerColor,
  type Presence,
  presenceOf,
  STATUSES,
  type Status,
} from "@/core/messages/rules.ts";
import { user } from "@/db/auth-schema.ts";
import type { Database } from "@/db/index.ts";
import {
  messengerConversations,
  messengerMembers,
  messengerMessages,
  messengerProfiles,
} from "@/db/schema.ts";

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
    })
    .from(user)
    .leftJoin(messengerProfiles, eq(messengerProfiles.userId, user.id))
    .where(and(eq(user.id, userId), eq(user.tenantSlug, tenantSlug)))
    .limit(1);
  if (!row) return undefined;
  return {
    userId: row.userId,
    name: row.name,
    role: row.role ?? "",
    photo: Boolean(row.photoPath),
    status: (STATUSES as readonly string[]).includes(row.status ?? "")
      ? (row.status as Status)
      : "disponivel",
    personalMessage: row.personalMessage ?? "",
    color: isColor(row.color ?? "") ? (row.color as MessengerColor) : "verde",
    sound: row.sound ?? true,
  };
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
  await database
    .update(messengerProfiles)
    .set({
      ...(input.status && (STATUSES as readonly string[]).includes(input.status)
        ? { status: input.status }
        : {}),
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
        presence: presenceOf(person.status, person.lastSeenAt, now),
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
}

/** The conversation's messages, oldest first; newer than `after` when given. */
export async function listMessagesWith(
  database: Database,
  tenantSlug: string,
  conversationId: string,
  viewer: Viewer,
  options: { after?: Date; limit?: number } = {},
): Promise<MessageView[] | undefined> {
  const conversation = await findConversationWith(
    database,
    tenantSlug,
    conversationId,
    viewer,
  );
  if (!conversation) return undefined;
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
    })
    .from(messengerMessages)
    .leftJoin(user, eq(user.id, messengerMessages.senderId))
    .where(
      and(
        eq(messengerMessages.conversationId, conversationId),
        options.after
          ? gt(messengerMessages.createdAt, options.after)
          : undefined,
      ),
    )
    .orderBy(desc(messengerMessages.createdAt))
    .limit(options.limit ?? 200);
  return rows.reverse().map((row) => ({
    ...row,
    senderName: row.senderName ?? "Conta removida",
    kind: row.kind as MessageKind,
  }));
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
): Promise<{ incoming: Incoming[]; unread: number }> {
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
  return {
    unread,
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
