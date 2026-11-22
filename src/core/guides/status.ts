import { z } from "zod";

/**
 * Where a guia stands after it is issued (decision of 22/11/2026: "faltou o
 * campo de concluída, aguardando pagamento e paga com anexo do comprovante
 * de pagamento"):
 *
 * 1. aguardando-pagamento: issued and handed to the party, who pays it at
 *    the bank or the city hall. Every guia starts here.
 * 2. paga: the party paid; the day and, when the office has it, the
 *    comprovante attached.
 * 3. concluida: the guia did its job: the escritura was drawn on it (or the
 *    certidão issued), and nothing else is expected from it.
 *
 * The step lives outside the guia's own data: correcting the guia rewrites
 * its payload, and a correction must never undo the payment.
 */
export const GUIDE_STATUSES = [
  "aguardando-pagamento",
  "paga",
  "concluida",
] as const;
export type GuideStatus = (typeof GUIDE_STATUSES)[number];

export const GUIDE_STATUS_LABELS: Record<GuideStatus, string> = {
  "aguardando-pagamento": "Aguardando pagamento",
  paga: "Paga",
  concluida: "Concluída",
};

/** What each step means, in the clerk's words, under its button. */
export const GUIDE_STATUS_HINTS: Record<GuideStatus, string> = {
  "aguardando-pagamento":
    "Emitida e entregue à parte, que paga no banco ou na prefeitura.",
  paga: "A parte pagou. Anexe o comprovante de pagamento para conferir.",
  concluida:
    "O ato foi lavrado com esta guia (ou a certidão foi emitida). Nada mais a fazer.",
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const optionalDate = z
  .string()
  .trim()
  .refine((v) => v === "" || ISO_DATE.test(v), "Data inválida.")
  .default("");

export const guideStatusInputSchema = z
  .object({
    status: z.enum(GUIDE_STATUSES),
    /** The last day to pay, as the guia or the fisco set it. */
    dueOn: optionalDate,
    /** When the party paid. */
    paidOn: optionalDate,
    /** When the act was drawn on it. */
    concludedOn: optionalDate,
    note: z.string().trim().max(2000).default(""),
  })
  .superRefine((value, ctx) => {
    if (value.status !== "aguardando-pagamento" && !value.paidOn) {
      ctx.addIssue({
        code: "custom",
        path: ["paidOn"],
        message: "Informe o dia do pagamento.",
      });
    }
    if (value.status === "concluida" && !value.concludedOn) {
      ctx.addIssue({
        code: "custom",
        path: ["concludedOn"],
        message: "Informe o dia em que a guia foi usada no ato.",
      });
    }
  });
export type GuideStatusInput = z.infer<typeof guideStatusInputSchema>;

/** The comprovante of payment, stored like any other upload. */
export const guideReceiptSchema = z.object({
  storedName: z.string(),
  displayName: z.string(),
  path: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number(),
  at: z.string(),
  by: z.string(),
});
export type GuideReceipt = z.infer<typeof guideReceiptSchema>;

const entrySchema = z.object({
  status: z.enum(GUIDE_STATUSES),
  dueOn: z.string().default(""),
  paidOn: z.string().default(""),
  concludedOn: z.string().default(""),
  note: z.string().default(""),
  receipt: guideReceiptSchema.nullable().default(null),
  at: z.string(),
  by: z.string(),
});
export type GuideStatusEntry = z.infer<typeof entrySchema>;

/** What is stored per guia: the current step and every earlier version. */
export const guideStatusRecordSchema = z.object({
  current: entrySchema.nullable(),
  history: z
    .array(
      entrySchema.extend({
        change: z.enum(["edited", "withdrawn", "receipt-removed"]),
      }),
    )
    .max(200)
    .default([]),
});
export type GuideStatusRecord = z.infer<typeof guideStatusRecordSchema>;

export const EMPTY_GUIDE_STATUS: GuideStatusRecord = {
  current: null,
  history: [],
};

/** The step a guia is at: the stored one, or the first. */
export function guideStatusOf(record: GuideStatusRecord): GuideStatus {
  return record.current?.status ?? "aguardando-pagamento";
}

/**
 * Whether the party is late: still waiting, with a due day already past.
 * `today` is the office's day.
 */
export function guidePaymentOverdue(
  record: GuideStatusRecord,
  today: string,
): boolean {
  const current = record.current;
  return (
    guideStatusOf(record) === "aguardando-pagamento" &&
    Boolean(current?.dueOn) &&
    (current?.dueOn ?? "") < today
  );
}

/** "2026-11-22" → "22/11/2026". */
export function brDate(iso: string): string {
  return ISO_DATE.test(iso)
    ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
    : iso;
}

/** One line for lists and the audit: "Paga em 20/11/2026, com comprovante". */
export function guideStatusSummary(record: GuideStatusRecord): string {
  const current = record.current;
  const status = guideStatusOf(record);
  if (!current || status === "aguardando-pagamento") {
    return current?.dueOn
      ? `Aguardando pagamento (vence em ${brDate(current.dueOn)})`
      : "Aguardando pagamento";
  }
  const receipt = current.receipt ? ", com comprovante" : ", sem comprovante";
  if (status === "paga") return `Paga em ${brDate(current.paidOn)}${receipt}`;
  return `Concluída em ${brDate(current.concludedOn)} (paga em ${brDate(current.paidOn)}${receipt})`;
}
