import { generateText, type ModelMessage } from "ai";
import { and, eq, sql } from "drizzle-orm";
import {
  ALIGNMENT_QUERIES,
  ALIGNMENT_START,
  alignmentInstructions,
  type ReplyApproval,
} from "@/core/dpo/alinhamento.ts";
import { resolveCitations } from "@/core/dpo/citations.ts";
import { DPO_COPY } from "@/core/dpo/copy.ts";
import {
  KNOWLEDGE_BASE,
  type KnowledgeProvision,
  SOURCES,
} from "@/core/dpo/knowledge/index.ts";
import { maskPersonalData } from "@/core/dpo/mask.ts";
import { formatExcerpts } from "@/core/dpo/prompts.ts";
import {
  effectiveLimit,
  isOverQuota,
  nextMonthStart,
  usageMonth,
} from "@/core/dpo/quota.ts";
import { buildIndex, type SearchIndex, search } from "@/core/dpo/search.ts";
import { parseDetails } from "@/core/request/kinds.ts";
import { formatDate } from "@/core/scheduling/calendar.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import type { Database } from "@/db/index.ts";
import { serviceRequests } from "@/db/schema.ts";
import { recordAuditWith } from "../audit.ts";
import type { DpoModels, SourceView } from "./assistant.ts";
import {
  formatOfficeExcerpts,
  officeExcerptsWith,
  sourceViewsWith,
} from "./office-base.ts";
import {
  appendMessageWith,
  countUsageWith,
  createConversationWith,
  type DpoConversation,
  getConversationWith,
  listMessagesWith,
  monthlyLimitWith,
  monthUsageWith,
} from "./store.ts";

/**
 * The conversation on one LGPD requerimento (core/dpo/alinhamento.ts):
 * the team writes, the Assistente Virtual answers from the norms' base and
 * asks what it needs. Everything here is masked before it is stored or
 * sent, except what the titular wrote in the requerimento, which goes as
 * it is (decision of 15/11/2026: "os dados deles eles mesmo informaram").
 * The name, protocol and dates are filled in by the platform.
 */

const HISTORY = 16;
const EXCERPTS = 10;
export const ALIGNMENT_MAX = 4000;

let index: SearchIndex | null = null;
function knowledgeIndex(): SearchIndex {
  index ??= buildIndex(KNOWLEDGE_BASE);
  return index;
}
const sourceName = (p: KnowledgeProvision) => SOURCES[p.source].name;

async function requestOf(database: Database, tenantSlug: string, id: string) {
  const [request] = await database
    .select()
    .from(serviceRequests)
    .where(
      and(
        eq(serviceRequests.tenantSlug, tenantSlug),
        eq(serviceRequests.id, id),
      ),
    );
  return request?.kind === "data-rights" ? request : null;
}

/** The requerimento's conversation, if it was started. */
async function conversationOf(
  database: Database,
  tenantSlug: string,
  details: { alignment?: { conversationId: string } },
): Promise<DpoConversation | null> {
  const id = details.alignment?.conversationId;
  if (!id) return null;
  const conversation = await getConversationWith(database, id);
  return conversation?.tenantSlug === tenantSlug &&
    conversation.kind === "data-rights"
    ? conversation
    : null;
}

export interface AlignmentView {
  id: string;
  role: "user" | "assistant" | "refusal";
  content: string;
  sources: SourceView[];
  createdAt: Date;
}

/** What the screen shows: the conversation, without the opening prompt. */
export async function alignmentMessagesWith(
  database: Database,
  tenantSlug: string,
  requestId: string,
): Promise<AlignmentView[]> {
  const request = await requestOf(database, tenantSlug, requestId);
  if (!request) return [];
  const conversation = await conversationOf(
    database,
    tenantSlug,
    parseDetails("data-rights", request.details),
  );
  if (!conversation) return [];
  const messages = (await listMessagesWith(database, conversation.id)).filter(
    (m) => !(m.role === "user" && m.content === ALIGNMENT_START),
  );
  return Promise.all(
    messages.map(async (m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      sources: await sourceViewsWith(database, tenantSlug, m.sources),
      createdAt: m.createdAt,
    })),
  );
}

export type AlignResult =
  | { status: "ok" }
  | { status: "blocked" | "error"; message: string };

/**
 * One turn of the conversation. An empty message opens it: the Assistente
 * Virtual analyses the pedido and asks. `fileText` is what was read from a
 * document the team attached for it, already out of the file (dropped).
 */
export async function alignDataRightsWith(
  database: Database,
  models: DpoModels,
  input: {
    tenant: Tenant;
    requestId: string;
    userId: string;
    userRole: string;
    message: string;
    fileText?: string;
    officeContext: string;
    now: Date;
  },
): Promise<AlignResult> {
  const typed = input.message.trim();
  if (typed.length > ALIGNMENT_MAX) {
    return {
      status: "error",
      message: `Escreva até ${ALIGNMENT_MAX} caracteres por mensagem.`,
    };
  }
  const request = await requestOf(database, input.tenant.slug, input.requestId);
  if (!request || request.status !== "new") {
    return { status: "error", message: "Requerimento não encontrado." };
  }
  const details = parseDetails("data-rights", request.details);
  let conversation = await conversationOf(database, input.tenant.slug, details);
  if (conversation && !typed && !input.fileText?.trim()) {
    return { status: "error", message: "Escreva a mensagem." };
  }

  const month = usageMonth(input.now);
  const [usage, configured] = await Promise.all([
    monthUsageWith(database, input.tenant.slug, month),
    monthlyLimitWith(database, input.tenant.slug),
  ]);
  if (isOverQuota(usage.answered, effectiveLimit(configured))) {
    return {
      status: "blocked",
      message: DPO_COPY.quotaReached(formatDate(nextMonthStart(month))),
    };
  }

  const raw = [
    typed || (conversation ? "" : ALIGNMENT_START),
    input.fileText?.trim()
      ? `Trecho de documento anexado pela serventia (lido e descartado):\n${input.fileText.trim().slice(0, 2500)}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const masked = maskPersonalData(raw);

  const history: ModelMessage[] = conversation
    ? (await listMessagesWith(database, conversation.id))
        .filter((m) => m.role !== "refusal")
        .slice(-HISTORY)
        .map((m) => ({
          role: m.role === "user" ? "user" : "assistant",
          content: m.content,
        }))
    : [];

  const excerpts = search(
    knowledgeIndex(),
    `${ALIGNMENT_QUERIES[details.right]} ${masked.text}`,
    EXCERPTS,
  );
  const office = await officeExcerptsWith(
    database,
    input.tenant.slug,
    `${ALIGNMENT_QUERIES[details.right]} ${typed}`,
  );
  let text: string;
  try {
    const result = await generateText({
      model: models.answer,
      instructions: `${alignmentInstructions(input.officeContext, details.right, (request.description ?? "").slice(0, 3000))}\n\n${formatExcerpts(excerpts, sourceName)}${formatOfficeExcerpts(office)}`,
      messages: [...history, { role: "user", content: masked.text }],
      providerOptions: models.providerOptions,
      maxOutputTokens: 2500,
    });
    text = result.text.trim();
  } catch {
    return { status: "error", message: DPO_COPY.failed };
  }
  if (!text) return { status: "error", message: DPO_COPY.failed };
  const resolved = resolveCitations(
    text,
    new Set([...excerpts.map((e) => e.id), ...office.map((e) => e.id)]),
  );

  await database.transaction(async (tx) => {
    const t = tx as unknown as Database;
    if (!conversation) {
      conversation = await createConversationWith(t, {
        tenantSlug: input.tenant.slug,
        userId: input.userId,
        userRole: input.userRole,
        kind: "data-rights",
        firstMessage: `Requerimento LGPD ${request.protocolNumber}`,
      });
      await t
        .update(serviceRequests)
        .set({
          details: sql`${serviceRequests.details} || ${JSON.stringify({ alignment: { conversationId: conversation.id } })}::jsonb`,
        })
        .where(eq(serviceRequests.id, request.id));
    }
    await appendMessageWith(t, {
      conversation,
      role: "user",
      content: masked.text,
      maskedCounts: masked.counts,
      at: input.now,
    });
    await appendMessageWith(t, {
      conversation,
      role: "assistant",
      content: resolved.text,
      sources: resolved.cited,
      invalidCitations: resolved.invalid,
      at: new Date(input.now.getTime() + 1),
    });
    await countUsageWith(t, input.tenant.slug, month, "answered");
    await recordAuditWith(t, {
      tenantSlug: input.tenant.slug,
      actorId: input.userId,
      action: "data-rights.align",
      targetType: "data-rights",
      targetId: request.protocolNumber,
    });
  });
  return { status: "ok" };
}

/** The conversation as stored (masked), for the draft of the answer. */
export async function alignmentStoredWith(
  database: Database,
  tenantSlug: string,
  requestId: string,
): Promise<{ role: "user" | "assistant" | "refusal"; content: string }[]> {
  const request = await requestOf(database, tenantSlug, requestId);
  if (!request) return [];
  const conversation = await conversationOf(
    database,
    tenantSlug,
    parseDetails("data-rights", request.details),
  );
  return conversation ? listMessagesWith(database, conversation.id) : [];
}

export type ApproveResult =
  | { status: "ok" }
  | { status: "error"; message: string };

/**
 * The final decision (`lgpd.decide`, checked by the caller): the draft as
 * saved is approved, word for word, by the encarregado or the Tabelião.
 */
export async function approveDataRightsReplyWith(
  database: Database,
  tenantSlug: string,
  requestId: string,
  approver: { id: string; name: string; role: string },
  now = new Date(),
): Promise<ApproveResult> {
  const request = await requestOf(database, tenantSlug, requestId);
  if (!request || request.status !== "new") {
    return { status: "error", message: "Requerimento não encontrado." };
  }
  const text = parseDetails("data-rights", request.details).draftReply?.trim();
  if (!text) {
    return {
      status: "error",
      message: "Salve o rascunho da resposta antes de aprovar.",
    };
  }
  const approval: ReplyApproval = {
    text,
    byId: approver.id,
    byName: approver.name,
    byRole: approver.role,
    at: now.toISOString(),
  };
  await database.transaction(async (tx) => {
    await tx
      .update(serviceRequests)
      .set({
        details: sql`${serviceRequests.details} || ${JSON.stringify({ approval })}::jsonb`,
        updatedAt: now,
      })
      .where(eq(serviceRequests.id, request.id));
    await recordAuditWith(tx as unknown as Database, {
      tenantSlug,
      actorId: approver.id,
      action: "data-rights.approve",
      targetType: "data-rights",
      targetId: request.protocolNumber,
    });
  });
  return { status: "ok" };
}
