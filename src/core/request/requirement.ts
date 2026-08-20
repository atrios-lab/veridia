import { z } from "zod";

/**
 * Something the office needs from the citizen before a service request can
 * move forward: a missing document, an unsigned form. It has its own
 * lifecycle, is registered by the office and resolved by the citizen through
 * the protocol consult they already have, with a single attachment as the
 * answer.
 */
export const REQUIREMENT_STATUSES = ["pending", "fulfilled"] as const;
export type RequirementStatus = (typeof REQUIREMENT_STATUSES)[number];

export const requirementTextSchema = z
  .string()
  .transform((s) => s.trim().replace(/\s+/g, " "))
  .pipe(
    z.string().min(1, "Descreva o que falta.").max(500, "Texto longo demais."),
  );

export interface Requirement {
  id: string;
  text: string;
  status: RequirementStatus;
  createdAt: Date;
  fulfilledAt: Date | null;
  resolutionAttachmentId: string | null;
}
