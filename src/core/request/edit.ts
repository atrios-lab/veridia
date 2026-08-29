import { z } from "zod";
import { MAX_MESSAGE_LENGTH, TEXT_TOO_LONG } from "../chat/message.ts";
import { fromZonedDateTime } from "../scheduling/calendar.ts";
import { isValidCpf } from "./form.ts";

/**
 * What the counter may correct on a request that already exists.
 *
 * Not the public form's schema: that one validates what a citizen submits,
 * acceptances, honeypot, a description gated by the act. This is an operator
 * fixing loose fields on something already protocolled, and the two are
 * different conversations.
 *
 * The act and the protocol number are absent on purpose: changing the act
 * changes the attribution and the legal basis of what was protocolled, which
 * is a new request, not an edit.
 *
 * `now` is a parameter, not `Date.now()`: same discipline as the calendar
 * module, so the rule can be tested without waiting for a clock.
 */
export function requestDataEditSchema(now: Date, timeZone: string) {
  return z.object({
    applicantName: z.string().trim().min(2, "Informe o nome do solicitante."),
    contact: z.string().trim().min(3, "Informe o contato."),
    cpf: z
      .string()
      .trim()
      .transform((value) => value.replace(/\D/g, ""))
      .refine((value) => value === "" || isValidCpf(value), "CPF inválido.")
      .transform((value) => value || null),
    purpose: z
      .string()
      .trim()
      .max(MAX_MESSAGE_LENGTH, TEXT_TOO_LONG)
      .transform((value) => value || null),
    description: z
      .string()
      .trim()
      .max(MAX_MESSAGE_LENGTH, TEXT_TOO_LONG)
      .transform((value) => value || null),
    createdAt: z
      .string()
      .min(1, "Informe a data e a hora do atendimento.")
      // Read on the office's wall clock, never the server's: the server runs
      // in UTC, so `new Date(local)` would file every walk-in three hours off.
      .transform((value) => fromZonedDateTime(value, timeZone))
      .refine((date) => !Number.isNaN(date.getTime()), "Data e hora inválidas.")
      // The counter files late, never early. A future date would also sort the
      // queue wrong for as long as the request exists.
      .refine(
        (date) => date.getTime() <= now.getTime(),
        "A data não pode estar no futuro.",
      ),
  });
}

export type RequestDataEdit = z.infer<ReturnType<typeof requestDataEditSchema>>;

/**
 * What may be stored as the purpose of a request, given the act.
 *
 * Lei 6.015 art. 17 forbids requiring a motive for a certificate, and the
 * public form honours that by never rendering the field. The counter is the
 * same office asking the same question: a panel that lets an operator type it
 * in is the same violation with a different door, so the rule lives here,
 * where both callers pass through, instead of in either screen.
 */
export function purposeFor(
  act: { requiresPurpose: boolean } | undefined,
  value: string | null,
): string | null {
  return act?.requiresPurpose ? value : null;
}
