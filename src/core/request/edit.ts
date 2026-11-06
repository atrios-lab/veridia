import { z } from "zod";
import type { Act } from "../acts/catalog.ts";
import { MAX_MESSAGE_LENGTH, TEXT_TOO_LONG } from "../chat/message.ts";
import { fromZonedDateTime } from "../scheduling/calendar.ts";
import {
  alternateDocumentFields,
  buildAlternateDocument,
  counterIdentityIssues,
  isValidCpf,
  isValidPhone,
} from "./form.ts";
import { type AlternateDocument, variantOwner } from "./kinds.ts";

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
    // Its own field since the public form started asking for it apart from
    // the contact. Empty is a real answer: it clears a number typed by
    // mistake, which is why this stays a string instead of going undefined.
    phone: z
      .string()
      .trim()
      .refine(
        (value) => value === "" || isValidPhone(value),
        "Informe um telefone com DDD.",
      ),
    cpf: z
      .string()
      .trim()
      .transform((value) => value.replace(/\D/g, ""))
      .refine((value) => value === "" || isValidCpf(value), "CPF inválido.")
      .transform((value) => value || null),
    ...alternateDocumentFields,
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
 * What a correction writes. `alternateDocument`: null removes the stored one,
 * absent leaves it alone.
 */
export type RequestDataUpdate = Omit<
  RequestDataEdit,
  "noCpf" | "alternateDocumentType" | "alternateDocumentNumber"
> & {
  actVariant?: string;
  alternateDocument?: AlternateDocument | null;
};

export type IdentityEdit =
  | {
      ok: true;
      cpf: string | null;
      alternateDocument: AlternateDocument | null;
    }
  | { ok: false; message: string };

/**
 * The identification a correction may store, given what is stored already.
 *
 * What was recorded can be replaced, never just erased. A request filed before
 * the CPF was required has neither, and stays correctable with neither: the
 * operator fixing a name must not have to go find a document to do it.
 */
export function resolveIdentityEdit(
  stored: { cpf?: string | null; alternateDocument?: AlternateDocument },
  input: Pick<
    RequestDataEdit,
    "cpf" | "noCpf" | "alternateDocumentType" | "alternateDocumentNumber"
  >,
): IdentityEdit {
  const [issue] = counterIdentityIssues(input);
  if (issue) return { ok: false, message: issue.message };
  if (input.noCpf) {
    return {
      ok: true,
      cpf: null,
      alternateDocument: buildAlternateDocument(input) ?? null,
    };
  }
  if (input.cpf) {
    return { ok: true, cpf: input.cpf, alternateDocument: null };
  }
  if (stored.cpf || stored.alternateDocument) {
    return {
      ok: false,
      message: "Informe o CPF ou marque que o cidadão não possui.",
    };
  }
  return { ok: true, cpf: null, alternateDocument: null };
}

export type VariantEdit =
  | { ok: true; actVariant?: string }
  | { ok: false; message: string };

/**
 * The kind of act an operator may store on a correction. Unlike the act itself
 * it is correctable: it changes neither the attribution nor the legal basis.
 *
 * Empty changes nothing rather than clearing: an old request with no kind must
 * stay correctable without anyone having to guess one, and a kind once known
 * is not lost by a blank field.
 */
export function resolveVariantEdit(
  act: Act | undefined,
  exemptionActId: string | undefined,
  raw: string,
): VariantEdit {
  const value = raw.trim();
  if (!value) return { ok: true };
  const owner = act && variantOwner(act, exemptionActId);
  return owner?.variants?.options.some((option) => option.id === value)
    ? { ok: true, actVariant: value }
    : { ok: false, message: "Escolha um tipo válido para este ato." };
}

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
