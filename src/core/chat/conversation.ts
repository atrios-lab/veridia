import { z } from "zod";
import { isValidContact } from "../request/form.ts";

/**
 * A conversation's life: waiting for an attendant, being answered, or
 * closed. There is no "abandoned" or "resolved": only how it got to
 * `closed` (`ClosedReason`) distinguishes those, because the citizen side
 * never needs to filter by outcome, only by whether it is still live.
 */
export const CONVERSATION_STATUSES = ["waiting", "active", "closed"] as const;
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];

/**
 * Why a conversation closed. `citizen` covers both giving up the wait and
 * ending the chat themselves: the widget never distinguishes the two to
 * the attendant, so neither does this vocabulary.
 */
export const CLOSED_REASONS = ["citizen", "inactivity", "staff"] as const;
export type ClosedReason = (typeof CLOSED_REASONS)[number];

const requiredText = (max: number) =>
  z
    .string()
    .transform((s) => s.trim().replace(/\s+/g, " "))
    .pipe(
      z.string().min(1, "Preencha este campo.").max(max, "Texto longo demais."),
    );

/**
 * The pre-chat: name, one contact and a subject before a citizen can queue.
 * The protocol is optional and never validated against the catalogue here:
 * a value that matches nothing is still accepted (see support-chat spec,
 * "Protocolo não encontrado não bloqueia"); matching it against real records
 * is `src/lib/chat.ts`'s job, which has the database this schema does not.
 */
export const prechatSchema = z.object({
  name: requiredText(160),
  contact: requiredText(160).refine(isValidContact, {
    message: "Informe um e-mail válido ou um telefone com DDD.",
  }),
  subject: requiredText(200),
  informedProtocolNumber: z
    .string()
    .trim()
    .max(40, "Protocolo inválido.")
    .optional()
    .transform((s) => (s === "" ? undefined : s)),
});

export type PrechatInput = z.infer<typeof prechatSchema>;
