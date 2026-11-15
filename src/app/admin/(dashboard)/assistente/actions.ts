"use server";

import {
  isQuestionTopic,
  QUESTION_MAX,
  QUESTION_TOPICS,
} from "@/core/assistente/duvidas.ts";
import { can } from "@/core/auth/roles.ts";
import { describeMasked } from "@/core/dpo/copy.ts";
import { maskPersonalData } from "@/core/dpo/mask.ts";
import { db } from "@/db/index.ts";
import { AiError, aiBlockedWith, answerQuestion } from "@/lib/ai.ts";
import { recordAuditWith } from "@/lib/audit.ts";
import { searchKnowledgeWith } from "@/lib/knowledge.ts";
import { isDpoRateLimited } from "@/lib/rate-limit.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

export type QuestionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | {
      status: "answered";
      inScope: boolean;
      answer: string;
      sources: string[];
      /** What was hidden from the question before it left, if anything. */
      masked: string;
    };

/**
 * "Tirar dúvida" (decision of 15/11/2026): the question goes without
 * personal data, with the legal base's passages on the screen's subject;
 * nothing of it is kept, and the audit records only that a question was
 * asked and where.
 */
export async function askQuestionAction(
  _previous: QuestionState,
  formData: FormData,
): Promise<QuestionState> {
  const topicKey = String(formData.get("tema") ?? "");
  if (!isQuestionTopic(topicKey)) {
    return { status: "error", message: "Assunto inválido." };
  }
  const topic = QUESTION_TOPICS[topicKey];
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", topic.permission, session.user.permissions)
  ) {
    return { status: "error", message: "Você não tem acesso a este assunto." };
  }
  const raw = String(formData.get("pergunta") ?? "").trim();
  if (raw.length < 5) {
    return { status: "error", message: "Escreva a dúvida." };
  }
  if (raw.length > QUESTION_MAX) {
    return {
      status: "error",
      message: `A dúvida pode ter até ${QUESTION_MAX} caracteres.`,
    };
  }
  if (await isDpoRateLimited(session.user.id)) {
    return {
      status: "error",
      message: "Muitas perguntas seguidas. Espere um pouco e tente de novo.",
    };
  }
  const tenant = await getTenant();
  const blocked = await aiBlockedWith(db, tenant.slug);
  if (blocked) return { status: "error", message: blocked };
  const masked = maskPersonalData(raw);
  try {
    const passages = await searchKnowledgeWith(db, tenant.slug, masked.text, {
      ...("area" in topic ? { area: topic.area } : {}),
      limit: 10,
    });
    const result = await answerQuestion({
      scope: topic.scope,
      question: masked.text,
      passages: passages.map((p) => ({
        reference: p.reference || p.title,
        heading: p.heading,
        text: p.text,
      })),
    });
    await recordAuditWith(db, {
      tenantSlug: tenant.slug,
      actorId: session.user.id,
      action: "ai.question",
      targetType: "tenant",
      targetId: topic.label,
    });
    return {
      status: "answered",
      inScope: result.inScope,
      answer: result.answer,
      sources: result.sources,
      masked: describeMasked(masked.counts),
    };
  } catch (error) {
    if (error instanceof AiError) {
      return { status: "error", message: error.message };
    }
    console.error("assistente.question", error);
    return {
      status: "error",
      message: "Não foi possível responder agora. Tente de novo em instantes.",
    };
  }
}
