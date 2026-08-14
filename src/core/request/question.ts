import { z } from "zod";
import type { EmailText } from "../email/text.ts";

/**
 * A question and answer thread attached to a service request — not a live
 * chat: one message posted, the office answers in its own time, and the
 * whole exchange rides on the protocol + key the citizen already holds. See
 * openspec/changes/perguntas-do-pedido/design.md, decision 1.
 */
export const QUESTION_AUTHOR_TYPES = ["citizen", "staff"] as const;
export type QuestionAuthorType = (typeof QUESTION_AUTHOR_TYPES)[number];

export const QUESTION_BODY_MAX_LENGTH = 2000;

export const questionBodySchema = z
  .string()
  .transform((s) => s.trim().replace(/\s+/g, " "))
  .pipe(
    z
      .string()
      .min(1, "Escreva algo antes de enviar.")
      .max(QUESTION_BODY_MAX_LENGTH, "Texto longo demais."),
  );

export type QuestionThreadStatus = "none" | "awaiting-reply" | "answered";

/**
 * The badge shown on both screens is never stored — it is only ever the
 * author of the last message. A column here would be a second place for the
 * status to say something the thread itself disagrees with.
 */
export function deriveQuestionThreadStatus(
  messages: ReadonlyArray<{ authorType: QuestionAuthorType }>,
): QuestionThreadStatus {
  const last = messages.at(-1);
  if (!last) return "none";
  return last.authorType === "citizen" ? "awaiting-reply" : "answered";
}

/**
 * The one notification a citizen gets today (see proposal.md, "Notificação
 * por e-mail"): that a reply exists, never the key and never the reply's own
 * text — both stay behind the protocol consult, same as everywhere else.
 */
export function buildQuestionAnsweredEmailText(input: {
  protocolNumber: string;
}): EmailText {
  return {
    subject: `Resposta sobre o pedido ${input.protocolNumber}`,
    paragraphs: [
      `Sua pergunta sobre o pedido ${input.protocolNumber} foi respondida.`,
      "Consulte pelo protocolo e pela chave de acesso que você já tem para ver a resposta.",
    ],
    buttonLabel: "Consultar meu pedido",
    footnote:
      "Por segurança, este e-mail não traz a chave de acesso nem o texto da " +
      "resposta: abra a consulta e informe seus dados de sempre.",
  };
}
