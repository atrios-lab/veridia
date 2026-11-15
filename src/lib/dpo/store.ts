import { and, asc, count, desc, eq, lt, max, sql } from "drizzle-orm";
import type { MaskCounts } from "@/core/dpo/mask.ts";
import type { Database } from "@/db/index.ts";
import {
  dpoConversations,
  dpoMessages,
  dpoMonthlyUsage,
  dpoTenantSettings,
} from "@/db/schema.ts";
import { recordAuditWith } from "../audit.ts";

/**
 * The DPO assistant's storage. Nothing here masks: every caller hands over
 * text that already went through `core/dpo/mask.ts`, and the functions that
 * write take it as given. Each person's own conversations are read with the
 * owner in the query, never filtered afterwards.
 */

export type DpoConversationKind = "chat" | "reply-draft";
export type DpoMessageRole = "user" | "assistant" | "refusal";

export interface DpoConversation {
  id: string;
  tenantSlug: string;
  userId: string | null;
  userRole: string;
  kind: DpoConversationKind;
  title: string;
  createdAt: Date;
  lastMessageAt: Date;
}

export interface DpoMessage {
  id: string;
  role: DpoMessageRole;
  content: string;
  maskedCounts: MaskCounts;
  sources: string[];
  invalidCitations: string[];
  createdAt: Date;
}

const TITLE_LENGTH = 80;

function titleOf(text: string): string {
  const line = text.replace(/\s+/g, " ").trim();
  return line.length > TITLE_LENGTH
    ? `${line.slice(0, TITLE_LENGTH - 1).trimEnd()}…`
    : line;
}

function toConversation(
  row: typeof dpoConversations.$inferSelect,
): DpoConversation {
  return { ...row, kind: row.kind as DpoConversationKind };
}

export async function createConversationWith(
  database: Database,
  input: {
    tenantSlug: string;
    userId: string;
    userRole: string;
    kind: DpoConversationKind;
    firstMessage: string;
  },
): Promise<DpoConversation> {
  const [row] = await database
    .insert(dpoConversations)
    .values({
      tenantSlug: input.tenantSlug,
      userId: input.userId,
      userRole: input.userRole,
      kind: input.kind,
      title: titleOf(input.firstMessage) || "Conversa",
    })
    .returning();
  return toConversation(row);
}

/** The conversation, only if it is this person's, in this office. */
export async function getOwnConversationWith(
  database: Database,
  input: { tenantSlug: string; userId: string; conversationId: string },
): Promise<DpoConversation | null> {
  if (!/^[0-9a-f-]{36}$/i.test(input.conversationId)) return null;
  const [row] = await database
    .select()
    .from(dpoConversations)
    .where(
      and(
        eq(dpoConversations.id, input.conversationId),
        eq(dpoConversations.tenantSlug, input.tenantSlug),
        eq(dpoConversations.userId, input.userId),
      ),
    );
  return row ? toConversation(row) : null;
}

/** Any conversation by id: the platform account's reading only. */
export async function getConversationWith(
  database: Database,
  conversationId: string,
): Promise<DpoConversation | null> {
  if (!/^[0-9a-f-]{36}$/i.test(conversationId)) return null;
  const [row] = await database
    .select()
    .from(dpoConversations)
    .where(eq(dpoConversations.id, conversationId));
  return row ? toConversation(row) : null;
}

export async function appendMessageWith(
  database: Database,
  input: {
    conversation: Pick<DpoConversation, "id" | "tenantSlug">;
    role: DpoMessageRole;
    content: string;
    maskedCounts?: MaskCounts;
    sources?: string[];
    invalidCitations?: string[];
    at?: Date;
  },
): Promise<void> {
  const at = input.at ?? new Date();
  await database.insert(dpoMessages).values({
    conversationId: input.conversation.id,
    tenantSlug: input.conversation.tenantSlug,
    role: input.role,
    content: input.content,
    maskedCounts: input.maskedCounts ?? {},
    sources: input.sources ?? [],
    invalidCitations: input.invalidCitations ?? [],
    createdAt: at,
  });
  await database
    .update(dpoConversations)
    .set({ lastMessageAt: at })
    .where(eq(dpoConversations.id, input.conversation.id));
}

export async function listMessagesWith(
  database: Database,
  conversationId: string,
): Promise<DpoMessage[]> {
  const rows = await database
    .select()
    .from(dpoMessages)
    .where(eq(dpoMessages.conversationId, conversationId))
    .orderBy(asc(dpoMessages.createdAt), asc(dpoMessages.id));
  return rows.map((row) => ({
    id: row.id,
    role: row.role as DpoMessageRole,
    content: row.content,
    maskedCounts: row.maskedCounts as MaskCounts,
    sources: row.sources as string[],
    invalidCitations: row.invalidCitations as string[],
    createdAt: row.createdAt,
  }));
}

export async function listOwnConversationsWith(
  database: Database,
  input: { tenantSlug: string; userId: string },
): Promise<DpoConversation[]> {
  const rows = await database
    .select()
    .from(dpoConversations)
    .where(
      and(
        eq(dpoConversations.tenantSlug, input.tenantSlug),
        eq(dpoConversations.userId, input.userId),
      ),
    )
    .orderBy(desc(dpoConversations.lastMessageAt));
  return rows.map(toConversation);
}

export async function listTenantConversationsWith(
  database: Database,
  tenantSlug: string,
): Promise<DpoConversation[]> {
  const rows = await database
    .select()
    .from(dpoConversations)
    .where(eq(dpoConversations.tenantSlug, tenantSlug))
    .orderBy(desc(dpoConversations.lastMessageAt));
  return rows.map(toConversation);
}

/* ------------------------------------------------------------------ usage */

export interface MonthUsage {
  answered: number;
  refused: number;
}

export async function monthUsageWith(
  database: Database,
  tenantSlug: string,
  month: string,
): Promise<MonthUsage> {
  const [row] = await database
    .select()
    .from(dpoMonthlyUsage)
    .where(
      and(
        eq(dpoMonthlyUsage.tenantSlug, tenantSlug),
        eq(dpoMonthlyUsage.month, month),
      ),
    );
  return { answered: row?.answered ?? 0, refused: row?.refused ?? 0 };
}

/** One more answered or refused question, atomically. */
export async function countUsageWith(
  database: Database,
  tenantSlug: string,
  month: string,
  outcome: keyof MonthUsage,
): Promise<void> {
  const column =
    outcome === "answered" ? dpoMonthlyUsage.answered : dpoMonthlyUsage.refused;
  await database
    .insert(dpoMonthlyUsage)
    .values({
      tenantSlug,
      month,
      answered: outcome === "answered" ? 1 : 0,
      refused: outcome === "refused" ? 1 : 0,
    })
    .onConflictDoUpdate({
      target: [dpoMonthlyUsage.tenantSlug, dpoMonthlyUsage.month],
      set: { [outcome]: sql`${column} + 1` },
    });
}

export async function monthlyLimitWith(
  database: Database,
  tenantSlug: string,
): Promise<number | null> {
  const [row] = await database
    .select({ monthlyLimit: dpoTenantSettings.monthlyLimit })
    .from(dpoTenantSettings)
    .where(eq(dpoTenantSettings.tenantSlug, tenantSlug));
  return row?.monthlyLimit ?? null;
}

/**
 * The platform account sets an office's ceiling (null goes back to the
 * default). The change lands in that office's audit trail with both values;
 * the platform's acts are hidden from the office there (lib/audit.ts).
 */
export async function setMonthlyLimitWith(
  database: Database,
  input: { tenantSlug: string; limit: number | null; actorId: string },
): Promise<void> {
  const previous = await monthlyLimitWith(database, input.tenantSlug);
  await database
    .insert(dpoTenantSettings)
    .values({
      tenantSlug: input.tenantSlug,
      monthlyLimit: input.limit,
      updatedBy: input.actorId,
    })
    .onConflictDoUpdate({
      target: dpoTenantSettings.tenantSlug,
      set: {
        monthlyLimit: input.limit,
        updatedBy: input.actorId,
        updatedAt: new Date(),
      },
    });
  await recordAuditWith(database, {
    tenantSlug: input.tenantSlug,
    actorId: input.actorId,
    action: "platform.dpo-limit",
    targetType: "tenant",
    // Hidden from the office like every act of the platform account
    // (lib/audit.ts notByPlatform); the platform reads it in the trail.
    targetId: input.tenantSlug,
    reason: `Teto mensal: de ${previous ?? "padrão"} para ${input.limit ?? "padrão"}`,
  });
}

export interface TenantDpoOverview {
  tenantSlug: string;
  usage: MonthUsage;
  limit: number | null;
  conversations: number;
  lastQuestionAt: Date | null;
}

/** Every office that has used the assistant or has a ceiling of its own. */
export async function listTenantOverviewWith(
  database: Database,
  month: string,
): Promise<TenantDpoOverview[]> {
  const [usageRows, limitRows, conversationRows] = await Promise.all([
    database
      .select()
      .from(dpoMonthlyUsage)
      .where(eq(dpoMonthlyUsage.month, month)),
    database.select().from(dpoTenantSettings),
    database
      .select({
        tenantSlug: dpoConversations.tenantSlug,
        conversations: count(),
        lastQuestionAt: max(dpoConversations.lastMessageAt),
      })
      .from(dpoConversations)
      .groupBy(dpoConversations.tenantSlug),
  ]);
  const slugs = new Set([
    ...usageRows.map((r) => r.tenantSlug),
    ...limitRows.map((r) => r.tenantSlug),
    ...conversationRows.map((r) => r.tenantSlug),
  ]);
  return [...slugs].map((tenantSlug) => {
    const usage = usageRows.find((r) => r.tenantSlug === tenantSlug);
    const conversations = conversationRows.find(
      (r) => r.tenantSlug === tenantSlug,
    );
    return {
      tenantSlug,
      usage: { answered: usage?.answered ?? 0, refused: usage?.refused ?? 0 },
      limit:
        limitRows.find((r) => r.tenantSlug === tenantSlug)?.monthlyLimit ??
        null,
      conversations: conversations?.conversations ?? 0,
      lastQuestionAt: conversations?.lastQuestionAt ?? null,
    };
  });
}

/**
 * Deletes conversations whose last message is older than `cutoff` (12
 * months: LGPD, keep only what is needed; decision of 15/11/2026, "pode
 * limpar após 12 meses"), and leaves the trail: one audit entry per office
 * with how many went, by the system, in the same transaction.
 */
export async function purgeConversationsBeforeWith(
  database: Database,
  cutoff: Date,
): Promise<number> {
  return database.transaction(async (tx) => {
    const removed = await tx
      .delete(dpoConversations)
      .where(lt(dpoConversations.lastMessageAt, cutoff))
      .returning({
        id: dpoConversations.id,
        tenantSlug: dpoConversations.tenantSlug,
      });
    const byOffice = new Map<string, number>();
    for (const row of removed) {
      byOffice.set(row.tenantSlug, (byOffice.get(row.tenantSlug) ?? 0) + 1);
    }
    for (const [tenantSlug, count] of byOffice) {
      await recordAuditWith(tx as unknown as Database, {
        tenantSlug,
        actorId: null,
        action: "dpo.purge",
        targetType: "tenant",
        targetId: tenantSlug,
        reason: `${count} ${count === 1 ? "conversa" : "conversas"} do Assistente do DPO com mais de 12 meses, removida${count === 1 ? "" : "s"} pela guarda automática.`,
      });
    }
    return removed.length;
  });
}
