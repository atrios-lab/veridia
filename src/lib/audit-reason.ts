import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { MIN_JUSTIFICATION } from "@/core/audit/severity.ts";

/**
 * The justification of a sensitive act (decision of 11/11/2026): whoever
 * excludes something says why, and the reason goes into the audit entry
 * the act writes, wherever deep in the libraries that happens. The server
 * action reads it from the form and sets it for the rest of its request;
 * `recordAuditWith` picks it up.
 */
const reasons = new AsyncLocalStorage<string>();

/**
 * Reads "justificativa" from the form. Null when it is good (and from here
 * on, every audit entry of this request carries it); the message to show
 * otherwise.
 */
export function justify(formData: FormData): string | null {
  const text = String(formData.get("justificativa") ?? "")
    .replace(/\r\n?/g, "\n")
    .trim()
    .slice(0, 1000);
  if (text.length < MIN_JUSTIFICATION) {
    return `Escreva a justificativa (pelo menos ${MIN_JUSTIFICATION} letras). Ela vai para a auditoria.`;
  }
  reasons.enterWith(text);
  return null;
}

/** The justification set for this request, if any. */
export function currentJustification(): string | undefined {
  return reasons.getStore();
}
