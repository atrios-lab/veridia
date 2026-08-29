import { z } from "zod";
import { MAX_MESSAGE_LENGTH, TEXT_TOO_LONG } from "../chat/message.ts";

/**
 * Something the office needs from the citizen before a service request can
 * move forward: a missing document, an unsigned form. It has its own
 * lifecycle, is registered by the office and resolved by the citizen through
 * the protocol consult they already have, with a single attachment as the
 * answer.
 */
export const REQUIREMENT_STATUSES = ["pending", "fulfilled"] as const;
export type RequirementStatus = (typeof REQUIREMENT_STATUSES)[number];

/**
 * The same shape as a conversation message, and on purpose: the office writes
 * both by hand, and an exigência is where the explanation belongs. The office
 * should not have to save words here only to spend them answering "qual
 * documento?" in the conversation below. Line breaks survive: a numbered list
 * of what is missing reads as a list, not as one paragraph. The ceiling is
 * there for the accident (a whole document pasted in), never for the writing.
 */
export const requirementTextSchema = z
  .string()
  .transform((s) => s.trim())
  .pipe(
    z
      .string()
      .min(1, "Descreva o que falta.")
      .max(MAX_MESSAGE_LENGTH, TEXT_TOO_LONG),
  );

export interface Requirement {
  id: string;
  text: string;
  status: RequirementStatus;
  createdAt: Date;
  fulfilledAt: Date | null;
  resolutionAttachmentId: string | null;
}
