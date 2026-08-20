import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, asc, desc, eq, gt, sql } from "drizzle-orm";
import { ATTRIBUTION_SHORT_NAMES } from "@/core/acts/catalog.ts";
import { canAssign } from "@/core/chat/capacity.ts";
import type {
  ClosedReason,
  ConversationStatus,
  PrechatInput,
} from "@/core/chat/conversation.ts";
import { isStale } from "@/core/chat/inactivity.ts";
import type { AuthorType } from "@/core/chat/message.ts";
import {
  formatProtocolNumber,
  PROTOCOL_PREFIXES,
  type ProtocolPrefix,
  parseProtocolNumber,
} from "@/core/request/protocol.ts";
import type { Attribution } from "@/core/tenant/schema.ts";
import { user } from "@/db/auth-schema.ts";
import { db } from "@/db/index.ts";
import { chatConversations, chatMessages, tenantContent } from "@/db/schema.ts";
import { OFFICE_CHAT_KEY } from "@/lib/tenant.ts";
import { recordAudit } from "./audit.ts";
import { findByProtocol } from "./service-request.ts";
import type { StoredAttachment } from "./uploads.ts";

export class ChatCapacityError extends Error {}
export class ChatTransferError extends Error {}

// The cookie that carries the citizen's opaque token. Named here, not in the
// Route Handlers, because Next's app router restricts a `route.ts` file to
// HTTP method exports and a short list of route config: anything else is
// silently dropped or warned about, so shared constants live in the data
// layer both handlers already import.
export const CHAT_TOKEN_COOKIE = "chat_token";
// A shift's worth of headroom past the longest realistic wait-plus-chat, not
// a promise the conversation stays reachable that long: closed and stale
// conversations already refuse new messages regardless of the cookie.
export const CHAT_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 12;

export type ChatConversation = typeof chatConversations.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;

const PROTOCOL_PREFIX_VALUES: readonly string[] =
  Object.values(PROTOCOL_PREFIXES);

// The citizen's only credential for this conversation: an opaque token held
// in an httpOnly cookie, never in localStorage: see design.md, "Sem
// protocolo nem chave de acesso para a conversa". Only its hash is stored,
// same discipline as access-key.ts, but with no human-typed alphabet to
// normalize: nobody ever reads this one out loud.
export function generateCitizenToken(): string {
  return randomBytes(32).toString("base64url");
}

function hashCitizenToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Whether the office's chat is switched on. Read directly, not through
 * `getTenant()`'s override merge: this is operational state, not part of
 * the Tenant shape (see src/lib/tenant.ts, OFFICE_CHAT_KEY). */
export async function isChatEnabled(tenantSlug: string): Promise<boolean> {
  try {
    const [row] = await db
      .select({ published: tenantContent.published })
      .from(tenantContent)
      .where(
        and(
          eq(tenantContent.tenantSlug, tenantSlug),
          eq(tenantContent.key, OFFICE_CHAT_KEY),
        ),
      )
      .limit(1);
    const settings = row?.published as { enabled?: boolean } | null | undefined;
    return settings?.enabled ?? false;
  } catch {
    // A database that is down leaves the chat off rather than taking the
    // whole public page down with it, the same posture `readTenantOverrides`
    // takes in src/lib/tenant.ts. The office loses a channel for as long as
    // the outage lasts; the site keeps serving the address and the telephone,
    // which is what a citizen needs most while nothing else works.
    return false;
  }
}

/**
 * Switches the office's chat on or off. Turning it off only stops the
 * floating button from appearing on the next poll: conversations already
 * `active` are untouched, see admin-support-chat spec, "Interruptor
 * 'Disponível para o chat' some o botão na hora".
 */
export async function setChatEnabled(
  tenantSlug: string,
  enabled: boolean,
  actorId: string,
): Promise<void> {
  await db
    .insert(tenantContent)
    .values({
      tenantSlug,
      key: OFFICE_CHAT_KEY,
      published: { enabled },
      publishedAt: new Date(),
      updatedBy: actorId,
    })
    .onConflictDoUpdate({
      target: [tenantContent.tenantSlug, tenantContent.key],
      set: {
        published: { enabled },
        publishedAt: new Date(),
        updatedAt: new Date(),
        updatedBy: actorId,
      },
    });
  await recordAudit({
    tenantSlug,
    actorId,
    action: "chat.settings",
    targetType: "chat-settings",
    targetId: enabled ? "on" : "off",
  });
}

/**
 * Starts a conversation from the widget's pre-chat. When the citizen typed a
 * protocol number that matches a real record of this office, it is
 * attached: a value that matches nothing is still accepted (see
 * support-chat spec, "Protocolo não encontrado não bloqueia").
 */
export async function startConversation(
  tenantSlug: string,
  prechat: PrechatInput,
  sourcePath: string | undefined,
): Promise<{ id: string; token: string; matchedProtocolNumber?: string }> {
  let matchedRequestId: string | undefined;
  let matchedProtocolNumber: string | undefined;

  const parsed = prechat.informedProtocolNumber
    ? parseProtocolNumber(prechat.informedProtocolNumber)
    : undefined;
  if (parsed && PROTOCOL_PREFIX_VALUES.includes(parsed.prefix)) {
    const normalized = formatProtocolNumber(
      parsed.prefix as ProtocolPrefix,
      parsed.year,
      parsed.sequence,
    );
    const matched = await findByProtocol(tenantSlug, normalized);
    if (matched) {
      matchedRequestId = matched.id;
      matchedProtocolNumber = matched.protocolNumber;
    }
  }

  const token = generateCitizenToken();
  const [created] = await db
    .insert(chatConversations)
    .values({
      tenantSlug,
      citizenName: prechat.name,
      citizenContact: prechat.contact,
      subject: prechat.subject,
      citizenTokenHash: hashCitizenToken(token),
      informedProtocolNumber: prechat.informedProtocolNumber ?? null,
      matchedRequestId: matchedRequestId ?? null,
      sourcePath: sourcePath ?? null,
    })
    .returning({ id: chatConversations.id });

  return { id: created.id, token, matchedProtocolNumber };
}

/**
 * Closes a conversation on its own once it has gone quiet too long,
 * recording why and leaving a system message: see design.md, "Inatividade
 * e fechamento automático avaliados de forma preguiçosa, sem cron". Called
 * from every read path that can reach an `active` conversation, never from
 * a scheduled job.
 */
async function closeIfStale(
  conversation: ChatConversation,
  now: Date,
): Promise<ChatConversation> {
  if (
    !isStale(
      {
        status: conversation.status as ConversationStatus,
        lastActivityAt: conversation.lastActivityAt,
      },
      now,
    )
  ) {
    return conversation;
  }
  await db
    .update(chatConversations)
    .set({ status: "closed", closedAt: now, closedReason: "inactivity" })
    .where(eq(chatConversations.id, conversation.id));
  await db.insert(chatMessages).values({
    conversationId: conversation.id,
    tenantSlug: conversation.tenantSlug,
    authorType: "system",
    body: "Atendimento encerrado por inatividade.",
  });
  return {
    ...conversation,
    status: "closed",
    closedAt: now,
    closedReason: "inactivity",
  };
}

/** The conversation behind a citizen's cookie token, or undefined if none matches. */
export async function getConversationForCitizen(
  tenantSlug: string,
  token: string,
): Promise<ChatConversation | undefined> {
  const [row] = await db
    .select()
    .from(chatConversations)
    .where(
      and(
        eq(chatConversations.tenantSlug, tenantSlug),
        eq(chatConversations.citizenTokenHash, hashCitizenToken(token)),
      ),
    )
    .limit(1);
  if (!row) return undefined;
  return closeIfStale(row, new Date());
}

/** The conversation by id, for the panel: permission is checked by the caller. */
export async function getConversation(
  tenantSlug: string,
  id: string,
): Promise<ChatConversation | undefined> {
  const [row] = await db
    .select()
    .from(chatConversations)
    .where(
      and(
        eq(chatConversations.tenantSlug, tenantSlug),
        eq(chatConversations.id, id),
      ),
    )
    .limit(1);
  if (!row) return undefined;
  return closeIfStale(row, new Date());
}

/**
 * Messages after a cursor, for the incremental poll. `forCitizen` strips
 * `note` rows: the citizen widget must never receive them, not even folded
 * into a generic list a client-side filter could get wrong.
 */
export async function listMessages(
  tenantSlug: string,
  conversationId: string,
  options: { after?: Date; forCitizen: boolean },
): Promise<ChatMessage[]> {
  const conditions = [
    eq(chatMessages.tenantSlug, tenantSlug),
    eq(chatMessages.conversationId, conversationId),
  ];
  if (options.after) conditions.push(gt(chatMessages.createdAt, options.after));
  const rows = await db
    .select()
    .from(chatMessages)
    .where(and(...conditions))
    .orderBy(asc(chatMessages.createdAt));
  return options.forCitizen
    ? rows.filter((row) => row.authorType !== "note")
    : rows;
}

/**
 * Records a message. A citizen's message refreshes `last_activity_at`,
 * which is the only clock `isStale`/`needsInactivityWarning` read: an
 * attendant typing never counts as the citizen still being there.
 */
export async function sendMessage(
  tenantSlug: string,
  conversationId: string,
  authorType: AuthorType,
  body: string,
  options: { actorUserId?: string; attachment?: StoredAttachment } = {},
): Promise<{ id: string }> {
  const [created] = await db
    .insert(chatMessages)
    .values({
      conversationId,
      tenantSlug,
      authorType,
      authorUserId: options.actorUserId ?? null,
      body,
      attachmentStoredName: options.attachment?.storedName ?? null,
      attachmentDisplayName: options.attachment?.displayName ?? null,
      attachmentPath: options.attachment?.path ?? null,
      attachmentMimeType: options.attachment?.mimeType ?? null,
      attachmentSizeBytes: options.attachment?.sizeBytes ?? null,
    })
    .returning({ id: chatMessages.id });

  if (authorType === "citizen") {
    await db
      .update(chatConversations)
      .set({ lastActivityAt: new Date() })
      .where(
        and(
          eq(chatConversations.tenantSlug, tenantSlug),
          eq(chatConversations.id, conversationId),
        ),
      );
  }
  return created;
}

/**
 * Where a waiting conversation sits in the queue (1-based), for "Você é o
 * 2º da fila". Undefined once the conversation is no longer `waiting`.
 */
export async function queuePosition(
  tenantSlug: string,
  conversationId: string,
): Promise<number | undefined> {
  const waiting = await waitingConversations(tenantSlug);
  const index = waiting.findIndex((c) => c.id === conversationId);
  return index === -1 ? undefined : index + 1;
}

/** Every conversation waiting for an attendant, oldest first. */
export async function waitingConversations(
  tenantSlug: string,
): Promise<ChatConversation[]> {
  return db
    .select()
    .from(chatConversations)
    .where(
      and(
        eq(chatConversations.tenantSlug, tenantSlug),
        eq(chatConversations.status, "waiting"),
      ),
    )
    .orderBy(asc(chatConversations.waitingSince));
}

/** Every conversation currently being attended, for the queue screen's
 * "Em atendimento" column: across every attendant of the office, not just
 * the one looking. */
export async function activeConversations(
  tenantSlug: string,
): Promise<ChatConversation[]> {
  return db
    .select()
    .from(chatConversations)
    .where(
      and(
        eq(chatConversations.tenantSlug, tenantSlug),
        eq(chatConversations.status, "active"),
      ),
    )
    .orderBy(asc(chatConversations.lastActivityAt));
}

/** How many conversations are waiting: the sidebar badge. */
export async function waitingCount(tenantSlug: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(chatConversations)
    .where(
      and(
        eq(chatConversations.tenantSlug, tenantSlug),
        eq(chatConversations.status, "waiting"),
      ),
    );
  return row?.count ?? 0;
}

async function activeCountForUser(
  tenantSlug: string,
  userId: string,
): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(chatConversations)
    .where(
      and(
        eq(chatConversations.tenantSlug, tenantSlug),
        eq(chatConversations.assignedUserId, userId),
        eq(chatConversations.status, "active"),
      ),
    );
  return row?.count ?? 0;
}

/**
 * Assigns a waiting conversation to the attendant who clicked "Atender".
 * Refuses at the limit of three, and refuses a conversation someone else
 * already took: the `status = 'waiting'` guard in the `WHERE` clause is
 * what makes the second click lose instead of double-assigning.
 */
export async function assignConversation(
  tenantSlug: string,
  conversationId: string,
  userId: string,
): Promise<void> {
  const activeCount = await activeCountForUser(tenantSlug, userId);
  if (!canAssign(activeCount)) {
    throw new ChatCapacityError("Você já está em 3 atendimentos.");
  }

  const [attendant] = await db
    .select({ chatSector: user.chatSector })
    .from(user)
    .where(eq(user.id, userId));

  const updated = await db
    .update(chatConversations)
    .set({
      status: "active",
      assignedUserId: userId,
      assignedSector: attendant?.chatSector ?? null,
    })
    .where(
      and(
        eq(chatConversations.tenantSlug, tenantSlug),
        eq(chatConversations.id, conversationId),
        eq(chatConversations.status, "waiting"),
      ),
    )
    .returning({ id: chatConversations.id });

  if (updated.length === 0) {
    throw new ChatCapacityError(
      "Esta conversa já foi assumida por outro atendente.",
    );
  }
}

function sectorLabel(sector: string | null): string | undefined {
  return sector
    ? (ATTRIBUTION_SHORT_NAMES[sector as Attribution] ?? undefined)
    : undefined;
}

/**
 * Transfers a conversation to a colleague, or back to the general queue
 * when `toUserId` is null. A note explaining why is mandatory (see
 * admin-support-chat spec, "Transferência exige nota interna"): it is
 * written as its own `note` message, alongside the `system` message the
 * citizen actually sees.
 */
export async function transferConversation(
  tenantSlug: string,
  conversationId: string,
  toUserId: string | null,
  note: string,
  actorUserId: string,
): Promise<void> {
  const trimmedNote = note.trim();
  if (!trimmedNote) {
    throw new ChatTransferError(
      "A nota interna é obrigatória para transferir.",
    );
  }

  let systemBody: string;
  if (toUserId) {
    const [attendant] = await db
      .select({ name: user.name, chatSector: user.chatSector })
      .from(user)
      .where(eq(user.id, toUserId));
    const sector = sectorLabel(attendant?.chatSector ?? null);
    await db
      .update(chatConversations)
      .set({
        status: "active",
        assignedUserId: toUserId,
        assignedSector: attendant?.chatSector ?? null,
      })
      .where(
        and(
          eq(chatConversations.tenantSlug, tenantSlug),
          eq(chatConversations.id, conversationId),
        ),
      );
    systemBody = `Você foi transferido para ${attendant?.name ?? "outro atendente"}${sector ? `, do ${sector}` : ""}.`;
  } else {
    await db
      .update(chatConversations)
      .set({
        status: "waiting",
        assignedUserId: null,
        assignedSector: null,
        waitingSince: new Date(),
      })
      .where(
        and(
          eq(chatConversations.tenantSlug, tenantSlug),
          eq(chatConversations.id, conversationId),
        ),
      );
    systemBody = "Você foi devolvido à fila geral de atendimento.";
  }

  await db.insert(chatMessages).values([
    {
      conversationId,
      tenantSlug,
      authorType: "system",
      body: systemBody,
    },
    {
      conversationId,
      tenantSlug,
      authorType: "note",
      authorUserId: actorUserId,
      body: trimmedNote,
    },
  ]);

  await recordAudit({
    tenantSlug,
    actorId: actorUserId,
    action: "chat.transfer",
    targetType: "chat-conversation",
    targetId: conversationId,
  });
}

export type CloseActor =
  | { kind: "staff"; userId: string }
  | { kind: "citizen" }
  | { kind: "inactivity" };

function closedReasonOf(actor: CloseActor): ClosedReason {
  if (actor.kind === "staff") return "staff";
  return actor.kind;
}

/**
 * Closes a conversation, with or without a link. `linkedRequestId` covers
 * both cases the design offers at closing time: the transcript already
 * points at an existing protocol, or at a request just launched from this
 * conversation: never both, but this function does not care which.
 */
export async function closeConversation(
  tenantSlug: string,
  conversationId: string,
  actor: CloseActor,
  options: {
    linkedRequestId?: string;
    rating?: number;
    ratingComment?: string;
    wantsTranscriptEmail?: boolean;
  } = {},
): Promise<void> {
  await db
    .update(chatConversations)
    .set({
      status: "closed",
      closedAt: new Date(),
      closedReason: closedReasonOf(actor),
      linkedRequestId: options.linkedRequestId ?? null,
      rating: options.rating ?? null,
      ratingComment: options.ratingComment ?? null,
      wantsTranscriptEmail: options.wantsTranscriptEmail ?? false,
    })
    .where(
      and(
        eq(chatConversations.tenantSlug, tenantSlug),
        eq(chatConversations.id, conversationId),
      ),
    );

  if (actor.kind === "staff") {
    await recordAudit({
      tenantSlug,
      actorId: actor.userId,
      action: "chat.close",
      targetType: "chat-conversation",
      targetId: conversationId,
    });
  }
}

/**
 * Records the citizen's rating on a conversation that is already closed:
 * separate from `closeConversation` because the conversation may have been
 * closed by staff or by inactivity, and rating it afterwards must not
 * overwrite `closedReason` with something that did not happen.
 */
export async function submitRating(
  tenantSlug: string,
  conversationId: string,
  rating: number,
  ratingComment: string | undefined,
  wantsTranscriptEmail: boolean,
): Promise<void> {
  await db
    .update(chatConversations)
    .set({ rating, ratingComment: ratingComment ?? null, wantsTranscriptEmail })
    .where(
      and(
        eq(chatConversations.tenantSlug, tenantSlug),
        eq(chatConversations.id, conversationId),
        eq(chatConversations.status, "closed"),
      ),
    );
}

export interface Colleague {
  id: string;
  name: string;
  chatStatus: string;
  chatSector: string | null;
  activeCount: number;
}

/** Every attendant of the office, with status and current load, for the transfer list. */
export async function colleagues(
  tenantSlug: string,
  excludeUserId?: string,
): Promise<Colleague[]> {
  const attendants = await db
    .select({
      id: user.id,
      name: user.name,
      chatStatus: user.chatStatus,
      chatSector: user.chatSector,
    })
    .from(user)
    .where(eq(user.tenantSlug, tenantSlug));

  const loads = await db
    .select({
      userId: chatConversations.assignedUserId,
      count: sql<number>`count(*)::int`,
    })
    .from(chatConversations)
    .where(
      and(
        eq(chatConversations.tenantSlug, tenantSlug),
        eq(chatConversations.status, "active"),
      ),
    )
    .groupBy(chatConversations.assignedUserId);
  const loadByUser = new Map(loads.map((row) => [row.userId, row.count]));

  return attendants
    .filter((a) => a.id !== excludeUserId)
    .map((a) => ({ ...a, activeCount: loadByUser.get(a.id) ?? 0 }));
}

/** The name and sector label of an attendant, for the widget's header. */
export async function attendantSummary(
  userId: string,
): Promise<{ name: string; sector?: string } | undefined> {
  const [attendant] = await db
    .select({ name: user.name, chatSector: user.chatSector })
    .from(user)
    .where(eq(user.id, userId));
  if (!attendant) return undefined;
  return { name: attendant.name, sector: sectorLabel(attendant.chatSector) };
}

export interface LinkedConversation {
  id: string;
  closedAt: Date | null;
  attendantName?: string;
}

/**
 * The chat transcripts linked to a service request: for the "Atendimentos
 * vinculados" block on its detail page. A conversation links to at most one
 * request (`linked_request_id`), so this is a plain lookup, not a join
 * table.
 */
export async function linkedConversations(
  tenantSlug: string,
  requestId: string,
): Promise<LinkedConversation[]> {
  const rows = await db
    .select()
    .from(chatConversations)
    .where(
      and(
        eq(chatConversations.tenantSlug, tenantSlug),
        eq(chatConversations.linkedRequestId, requestId),
      ),
    )
    .orderBy(desc(chatConversations.closedAt));
  return Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      closedAt: row.closedAt,
      attendantName: row.assignedUserId
        ? (await attendantSummary(row.assignedUserId))?.name
        : undefined,
    })),
  );
}

/** Sets an attendant's own status (Disponível/Ocupado/Ausente). */
export async function setChatStatus(
  userId: string,
  status: string,
): Promise<void> {
  await db.update(user).set({ chatStatus: status }).where(eq(user.id, userId));
}
