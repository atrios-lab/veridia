import { z } from "zod";

/**
 * Who wrote a message. `note` is its own type, not a flag on `staff`: see
 * design.md, "`note` é seu próprio `author_type`": a note must never reach
 * the citizen, and a boolean next to a shared type is the kind of field a
 * query forgets to filter.
 */
export const AUTHOR_TYPES = ["citizen", "staff", "system", "note"] as const;
export type AuthorType = (typeof AUTHOR_TYPES)[number];

export const MAX_MESSAGE_LENGTH = 4000;

/**
 * Lives next to the ceiling so the two never drift apart. "Texto longo
 * demais." on its own never said how long is too long, which is useless to
 * whoever just lost the end of what they wrote.
 */
export const TEXT_TOO_LONG = `O texto pode ter até ${MAX_MESSAGE_LENGTH.toLocaleString(
  "pt-BR",
)} caracteres.`;

export const messageBodySchema = z
  .string()
  .transform((s) => s.trim())
  .pipe(
    z
      .string()
      .min(1, "Escreva uma mensagem.")
      .max(MAX_MESSAGE_LENGTH, "Mensagem longa demais."),
  );
