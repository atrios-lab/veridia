import {
  generateText,
  type LanguageModel,
  type ModelMessage,
  Output,
  streamText,
} from "ai";
import { z } from "zod";
import { resolveCitations } from "@/core/dpo/citations.ts";
import { DPO_COPY, describeMasked } from "@/core/dpo/copy.ts";
import {
  KNOWLEDGE_BASE,
  type KnowledgeProvision,
  provisionById,
  SOURCES,
} from "@/core/dpo/knowledge/index.ts";
import { maskPersonalData } from "@/core/dpo/mask.ts";
import {
  fillPlaceholders,
  hasGaps,
  type PlaceholderValues,
} from "@/core/dpo/placeholders.ts";
import {
  answerInstructions,
  formatExcerpts,
  REPLY_DRAFT_QUERIES,
  replyDraftInstructions,
  replyDraftPrompt,
  TRIAGE_INSTRUCTIONS,
} from "@/core/dpo/prompts.ts";
import {
  effectiveLimit,
  isOverQuota,
  nextMonthStart,
  usageMonth,
} from "@/core/dpo/quota.ts";
import { buildIndex, type SearchIndex, search } from "@/core/dpo/search.ts";
import type { DataRight } from "@/core/request/kinds.ts";
import { formatDate } from "@/core/scheduling/calendar.ts";
import type { Database } from "@/db/index.ts";
import {
  appendMessageWith,
  countUsageWith,
  createConversationWith,
  type DpoConversation,
  getOwnConversationWith,
  listMessagesWith,
  monthlyLimitWith,
  monthUsageWith,
} from "./store.ts";

/**
 * One question to the DPO assistant, from the person's text to the stored
 * answer (design of the change `assistente-do-dpo`, decision 1). The models
 * come in as a dependency, so the tests run the whole flow with the AI
 * SDK's mock model and a PGlite database.
 *
 * The first thing done with the person's text is masking it. From then on
 * only the masked text exists here: it is what gets stored, what the models
 * receive and what goes back to the screen.
 */

export interface DpoModels {
  triage: LanguageModel;
  answer: LanguageModel;
  /** Provider options passed to every call, if any. */
  providerOptions?: Parameters<typeof generateText>[0]["providerOptions"];
}

/** Longest message accepted: a question, not a pasted document. */
export const MAX_MESSAGE_LENGTH = 4000;
const HISTORY_MESSAGES = 10;
const EXCERPTS = 10;

let index: SearchIndex | null = null;
function knowledgeIndex(): SearchIndex {
  index ??= buildIndex(KNOWLEDGE_BASE);
  return index;
}

export interface SourceView {
  id: string;
  citation: string;
  sourceName: string;
  guidance: boolean;
  text: string;
}

export function sourceView(id: string): SourceView | null {
  const provision = provisionById(id);
  if (!provision) return null;
  const source = SOURCES[provision.source];
  return {
    id,
    citation: provision.citation,
    sourceName: source.name,
    guidance: source.kind === "guidance",
    text: provision.text,
  };
}

export type DpoEvent =
  | { type: "blocked"; message: string }
  | { type: "error"; message: string }
  | {
      type: "start";
      conversationId: string;
      maskedText: string;
      maskedNotice: string;
    }
  | { type: "refused"; text: string }
  | { type: "delta"; text: string }
  | {
      type: "done";
      /** The stored answer, for the document's download. */
      messageId: string;
      text: string;
      sources: SourceView[];
      noSource: boolean;
      usage: { answered: number; limit: number };
    };

export interface AskInput {
  tenantSlug: string;
  userId: string;
  userRole: string;
  conversationId: string | null;
  message: string;
  officeContext: string;
  now: Date;
  /** The office's markers (core/dpo/placeholders), filled in the answer. */
  officeValues?: PlaceholderValues;
}

interface QuotaState {
  month: string;
  answered: number;
  limit: number;
}

async function quotaState(
  database: Database,
  tenantSlug: string,
  now: Date,
): Promise<QuotaState> {
  const month = usageMonth(now);
  const [usage, configured] = await Promise.all([
    monthUsageWith(database, tenantSlug, month),
    monthlyLimitWith(database, tenantSlug),
  ]);
  return { month, answered: usage.answered, limit: effectiveLimit(configured) };
}

function quotaMessage(month: string): string {
  return DPO_COPY.quotaReached(formatDate(nextMonthStart(month)));
}

function sourceName(provision: KnowledgeProvision): string {
  return SOURCES[provision.source].name;
}

const TriageSchema = z.object({
  inScope: z.boolean(),
  searchQuery: z.string(),
});

export async function* askDpoWith(
  database: Database,
  models: DpoModels,
  input: AskInput,
): AsyncGenerator<DpoEvent> {
  const message = input.message.trim();
  if (!message || message.length > MAX_MESSAGE_LENGTH) {
    yield {
      type: "error",
      message: `Escreva uma pergunta de até ${MAX_MESSAGE_LENGTH} caracteres.`,
    };
    return;
  }

  const quota = await quotaState(database, input.tenantSlug, input.now);
  if (isOverQuota(quota.answered, quota.limit)) {
    yield { type: "blocked", message: quotaMessage(quota.month) };
    return;
  }

  const masked = maskPersonalData(message);

  let conversation: DpoConversation | null;
  if (input.conversationId) {
    conversation = await getOwnConversationWith(database, {
      tenantSlug: input.tenantSlug,
      userId: input.userId,
      conversationId: input.conversationId,
    });
    if (!conversation) {
      yield { type: "error", message: "Conversa não encontrada." };
      return;
    }
  } else {
    conversation = await createConversationWith(database, {
      tenantSlug: input.tenantSlug,
      userId: input.userId,
      userRole: input.userRole,
      kind: "chat",
      firstMessage: masked.text,
    });
  }

  const history: ModelMessage[] = (
    await listMessagesWith(database, conversation.id)
  )
    .filter((m) => m.role !== "refusal")
    .slice(-HISTORY_MESSAGES)
    .map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.content,
    }));

  await appendMessageWith(database, {
    conversation,
    role: "user",
    content: masked.text,
    maskedCounts: masked.counts,
  });
  yield {
    type: "start",
    conversationId: conversation.id,
    maskedText: masked.text,
    maskedNotice: describeMasked(masked.counts),
  };

  let triage: z.infer<typeof TriageSchema>;
  try {
    const result = await generateText({
      model: models.triage,
      instructions: TRIAGE_INSTRUCTIONS,
      prompt: masked.text,
      output: Output.object({ schema: TriageSchema }),
      providerOptions: models.providerOptions,
      maxOutputTokens: 300,
    });
    triage = result.output;
  } catch {
    yield { type: "error", message: DPO_COPY.failed };
    return;
  }

  if (!triage.inScope) {
    await appendMessageWith(database, {
      conversation,
      role: "refusal",
      content: DPO_COPY.refusal,
    });
    await countUsageWith(database, input.tenantSlug, quota.month, "refused");
    yield { type: "refused", text: DPO_COPY.refusal };
    return;
  }

  const excerpts = search(
    knowledgeIndex(),
    `${triage.searchQuery} ${masked.text}`,
    EXCERPTS,
  );

  let failure: unknown = null;
  const result = streamText({
    model: models.answer,
    instructions: `${answerInstructions(input.officeContext)}\n\n${formatExcerpts(excerpts, sourceName)}`,
    messages: [...history, { role: "user", content: masked.text }],
    providerOptions: models.providerOptions,
    maxOutputTokens: 2500,
    onError: ({ error }) => {
      failure = error;
    },
  });

  let full = "";
  try {
    for await (const delta of result.textStream) {
      full += delta;
      yield { type: "delta", text: delta };
    }
  } catch (error) {
    failure = error;
  }
  if (failure || !full.trim()) {
    yield { type: "error", message: DPO_COPY.failed };
    return;
  }

  const resolved = resolveCitations(full, new Set(excerpts.map((e) => e.id)));
  // The office's own data goes in on the platform's side: the text comes
  // out ready (decision of 15/11/2026), never with the office to complete.
  const text = input.officeValues
    ? fillPlaceholders(resolved.text, input.officeValues)
    : resolved.text;
  const messageId = await appendMessageWith(database, {
    conversation,
    role: "assistant",
    content: text,
    sources: resolved.cited,
    invalidCitations: resolved.invalid,
  });
  await countUsageWith(database, input.tenantSlug, quota.month, "answered");
  yield {
    type: "done",
    messageId,
    text,
    sources: resolved.cited
      .map(sourceView)
      .filter((s): s is SourceView => s !== null),
    noSource: resolved.cited.length === 0,
    usage: { answered: quota.answered + 1, limit: quota.limit },
  };
}

export type DraftReplyResult =
  | { status: "ok"; draft: string }
  | { status: "blocked" | "error"; message: string };

/**
 * The LGPD requerimento's "Rascunhar resposta": the model gets only the
 * right asked, what the titular wrote in the requerimento (decision of
 * 15/11/2026: "os dados deles eles mesmo informaram") and the team's
 * masked note. Never anything the data subject
 * wrote or who they are. The draft comes back with markers, which the
 * caller fills in on the platform's side (core/dpo/placeholders.ts).
 */
export async function draftReplyWith(
  database: Database,
  models: DpoModels,
  input: {
    tenantSlug: string;
    /** Null when the system drafts on arrival, with no one asking. */
    userId: string | null;
    userRole: string;
    right: DataRight;
    note: string;
    /** What the titular wrote in the requerimento, in their own words. */
    titularRequest?: string;
    officeContext: string;
    now: Date;
  },
): Promise<DraftReplyResult> {
  if (input.note.length > MAX_MESSAGE_LENGTH) {
    return {
      status: "error",
      message: `A observação pode ter até ${MAX_MESSAGE_LENGTH} caracteres.`,
    };
  }
  const quota = await quotaState(database, input.tenantSlug, input.now);
  if (isOverQuota(quota.answered, quota.limit)) {
    return { status: "blocked", message: quotaMessage(quota.month) };
  }

  const note = maskPersonalData(input.note);
  const prompt = replyDraftPrompt(
    input.right,
    note.text,
    (input.titularRequest ?? "").slice(0, 3000),
  );
  const excerpts = search(
    knowledgeIndex(),
    REPLY_DRAFT_QUERIES[input.right],
    EXCERPTS,
  );

  let draft: string;
  try {
    const result = await generateText({
      model: models.answer,
      instructions: `${replyDraftInstructions(input.officeContext)}\n\n${formatExcerpts(excerpts, sourceName)}`,
      prompt,
      providerOptions: models.providerOptions,
      maxOutputTokens: 2000,
    });
    // The letter goes to a citizen: no source markers in it.
    draft = result.text.replace(/\s*\[\[fonte:[a-z0-9-]+\]\]/g, "").trim();
    // Nothing left to complete (decision of 15/11/2026): one rewrite.
    if (hasGaps(draft)) {
      const again = await generateText({
        model: models.answer,
        instructions: `${replyDraftInstructions(input.officeContext)}\n\n${formatExcerpts(excerpts, sourceName)}`,
        messages: [
          { role: "user", content: prompt },
          { role: "assistant", content: draft },
          {
            role: "user",
            content:
              "O texto ainda tem lacunas ou campos para completar. Reescreva a resposta inteira, completa e definitiva, sem nenhum campo para preencher, usando só os marcadores permitidos.",
          },
        ],
        providerOptions: models.providerOptions,
        maxOutputTokens: 2000,
      });
      const rewritten = again.text
        .replace(/\s*\[\[fonte:[a-z0-9-]+\]\]/g, "")
        .trim();
      if (rewritten) draft = rewritten;
    }
  } catch {
    return { status: "error", message: DPO_COPY.failed };
  }
  if (!draft) return { status: "error", message: DPO_COPY.failed };

  const conversation = await createConversationWith(database, {
    tenantSlug: input.tenantSlug,
    userId: input.userId,
    userRole: input.userRole,
    kind: "reply-draft",
    firstMessage: `Rascunho de resposta: ${prompt}`,
  });
  await appendMessageWith(database, {
    conversation,
    role: "user",
    content: prompt,
    maskedCounts: note.counts,
  });
  // Stored with its markers, before anything is filled in.
  await appendMessageWith(database, {
    conversation,
    role: "assistant",
    content: draft,
  });
  await countUsageWith(database, input.tenantSlug, quota.month, "answered");
  return { status: "ok", draft };
}
