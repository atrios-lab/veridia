import { z } from "zod";

/**
 * Who wrote a message. `note` is its own type, not a flag on `staff` — see
 * design.md, "`note` é seu próprio `author_type`": a note must never reach
 * the citizen, and a boolean next to a shared type is the kind of field a
 * query forgets to filter.
 */
export const AUTHOR_TYPES = ["citizen", "staff", "system", "note"] as const;
export type AuthorType = (typeof AUTHOR_TYPES)[number];

export const MAX_MESSAGE_LENGTH = 4000;

export const messageBodySchema = z
  .string()
  .transform((s) => s.trim())
  .pipe(
    z
      .string()
      .min(1, "Escreva uma mensagem.")
      .max(MAX_MESSAGE_LENGTH, "Mensagem longa demais."),
  );
