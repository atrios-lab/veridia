import type { ClosedReason } from "./conversation.ts";

/**
 * How a finished conversation says who ended it, to each side. Every ending
 * says so, and every ending leaves a way out of the window: a conversation
 * that just stops, with nothing to click, reads as a frozen screen.
 */
export function closedByForCitizen(
  reason: string | null,
  attendantName?: string,
): string {
  switch (reason as ClosedReason | null) {
    case "citizen":
      return "Você encerrou este atendimento.";
    case "staff":
      return attendantName
        ? `${attendantName} encerrou este atendimento.`
        : "O cartório encerrou este atendimento.";
    case "inactivity":
      return "O atendimento foi encerrado por falta de resposta.";
    default:
      return "Este atendimento foi encerrado.";
  }
}

export function closedByForStaff(reason: string | null): string {
  switch (reason as ClosedReason | null) {
    case "citizen":
      return "Conversa encerrada pelo cidadão.";
    case "staff":
      return "Conversa encerrada pelo atendimento.";
    case "inactivity":
      return "Conversa encerrada por inatividade do cidadão.";
    default:
      return "Conversa encerrada.";
  }
}

/**
 * Why a citizen gave up before the conversation concluded, asked before it
 * closes. What they pick goes into the conversation as a system line, so
 * the office reads it in the transcript.
 */
export const GIVE_UP_REASONS = [
  "A espera está demorando",
  "Resolvi de outra forma",
  "Vou falar por outro canal",
  "Entrei por engano",
  "Outro motivo",
] as const;
export type GiveUpReason = (typeof GIVE_UP_REASONS)[number];

export const GIVE_UP_DETAIL_MAX = 300;

export function isGiveUpReason(value: unknown): value is GiveUpReason {
  return (
    typeof value === "string" &&
    (GIVE_UP_REASONS as readonly string[]).includes(value)
  );
}

/** The system line a give-up leaves, with the citizen's own words if any. */
export function giveUpMessage(reason: GiveUpReason, detail?: string): string {
  const text = detail?.trim().replace(/\s+/g, " ").slice(0, GIVE_UP_DETAIL_MAX);
  return text
    ? `Motivo do encerramento pelo cidadão: ${reason}. "${text}"`
    : `Motivo do encerramento pelo cidadão: ${reason}.`;
}

/** The line that points the citizen to the office's e-mail. */
export function emailHelpLine(email: string): string {
  return `Em caso de dúvida, escreva para ${email}.`;
}
