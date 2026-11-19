import { z } from "zod";
import { formatCpf, isValidCpf, maskCpf, normalizeCpf } from "./form.ts";
import type { ServiceRequestStatus } from "./kinds.ts";

/**
 * How a request is closed once its final document is attached, and who came
 * to pick it up at the counter (decision of 19/11/2026). Pure rules, no I/O.
 */

/** The two ways to close: digital (done at once) or at the counter. */
export const CLOSING_MODES = ["digital", "counter"] as const;
export type ClosingMode = (typeof CLOSING_MODES)[number];

export const CLOSING_LABELS: Record<ClosingMode, string> = {
  digital: "Concluir com entrega digital",
  counter: "Aguardando retirada no balcão",
};

/** The andamento each way of closing leads to. */
export const CLOSING_STATUS: Record<ClosingMode, ServiceRequestStatus> = {
  digital: "done",
  counter: "ready-for-pickup",
};

/**
 * The andamentos where a request that has its document is asked how it
 * ends. Before the work starts, or while it waits for payment or an
 * exigência, a document attached is not the end of the story.
 */
const ASK_FROM: readonly string[] = ["new", "in-review", "processing"];

/** What the delivery card shows, from the request and what it holds. */
export type ClosingStage =
  /** Nothing to ask yet: no document, or the request is somewhere else. */
  | "none"
  /** The document is attached: ask digital or counter. */
  | "ask"
  /** Held for signature: the citizen does not see it, so it cannot close. */
  | "held"
  /** Waiting for the pickup: ask who came. */
  | "pickup"
  /** Done and picked up at the counter: show who. */
  | "picked-up";

export function closingStage(input: {
  status: string;
  /** Documents attached for the citizen and released to them. */
  released: number;
  /** Documents attached but held until signed. */
  held: number;
  hasPickup: boolean;
}): ClosingStage {
  if (input.status === "ready-for-pickup") return "pickup";
  if (input.status === "done") return input.hasPickup ? "picked-up" : "none";
  if (!ASK_FROM.includes(input.status)) return "none";
  if (input.released > 0) return "ask";
  return input.held > 0 ? "held" : "none";
}

// Who picks up -----------------------------------------------------------

export const PICKUP_RELATIONS = [
  "applicant",
  "attorney",
  "authorized",
  "relative",
  "other",
] as const;
export type PickupRelation = (typeof PICKUP_RELATIONS)[number];

export const PICKUP_RELATION_LABELS: Record<PickupRelation, string> = {
  applicant: "O próprio solicitante",
  attorney: "Advogado ou procurador",
  authorized: "Pessoa autorizada pelo solicitante",
  relative: "Familiar",
  other: "Outra pessoa",
};

export const PICKUP_DOCUMENT_TYPES = ["cpf", "rg", "cnh", "other"] as const;
export type PickupDocumentType = (typeof PICKUP_DOCUMENT_TYPES)[number];

export const PICKUP_DOCUMENT_LABELS: Record<PickupDocumentType, string> = {
  cpf: "CPF",
  rg: "RG",
  cnh: "CNH",
  other: "Outro documento",
};

export const PICKUP_NAME_MAX = 120;
export const PICKUP_NOTE_MAX = 500;
const DOCUMENT_MAX = 30;

export const PickupInputSchema = z
  .object({
    personName: z
      .string()
      .trim()
      .min(5, "Escreva o nome completo de quem retirou.")
      .max(PICKUP_NAME_MAX, `O nome pode ter até ${PICKUP_NAME_MAX} letras.`),
    relation: z.enum(PICKUP_RELATIONS, "Diga quem retirou."),
    documentType: z.enum(PICKUP_DOCUMENT_TYPES, "Escolha o documento."),
    documentNumber: z
      .string()
      .trim()
      .min(3, "Informe o número do documento.")
      .max(DOCUMENT_MAX, `O número pode ter até ${DOCUMENT_MAX} caracteres.`),
    note: z
      .string()
      .trim()
      .max(
        PICKUP_NOTE_MAX,
        `A observação pode ter até ${PICKUP_NOTE_MAX} letras.`,
      ),
  })
  .superRefine((value, ctx) => {
    if (value.documentType === "cpf" && !isValidCpf(value.documentNumber)) {
      ctx.addIssue({
        code: "custom",
        path: ["documentNumber"],
        message: "CPF inválido. Confira os números.",
      });
    }
  })
  .transform((value) => ({
    ...value,
    // The CPF is kept as digits; the other documents as typed.
    documentNumber:
      value.documentType === "cpf"
        ? normalizeCpf(value.documentNumber)
        : value.documentNumber,
  }));
export type PickupInput = z.infer<typeof PickupInputSchema>;

/** One pickup as the panel reads it. */
export interface PickupRecord {
  id: string;
  personName: string;
  relation: PickupRelation;
  documentType: PickupDocumentType;
  documentNumber: string;
  note: string;
  /** ISO instant. */
  pickedUpAt: string;
  registeredBy: string | null;
}

/**
 * The document as the panel shows it back: a CPF with its middle hidden,
 * any other number with only its last digits. The full number stays in the
 * record, as the proof of who took the document.
 */
export function describeDocument(
  type: PickupDocumentType,
  number: string,
): string {
  const label = PICKUP_DOCUMENT_LABELS[type];
  if (type === "cpf") return `${label} ${maskCpf(number)}`;
  const shown = number.slice(-3);
  return `${label} ${number.length > 3 ? "***" : ""}${shown}`;
}

/** A CPF typed with its dots and dash, for the field. */
export const typedCpf = formatCpf;
