import { z } from "zod";
import type { Act } from "../acts/catalog.ts";

/** Digits only, the way a CPF is stored and compared. */
export function normalizeCpf(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Check digits, not just eleven digits. A typo caught here is a request the
 * office does not have to chase the citizen about later.
 */
export function isValidCpf(value: string): boolean {
  const digits = normalizeCpf(value);
  if (digits.length !== 11) return false;
  // Repeated digits pass the arithmetic but are never issued.
  if (/^(\d)\1{10}$/.test(digits)) return false;

  for (const [length, position] of [
    [9, 10],
    [10, 11],
  ]) {
    let sum = 0;
    for (let i = 0; i < length; i++) {
      sum += Number(digits[i]) * (position - i);
    }
    const remainder = (sum * 10) % 11;
    const expected = remainder === 10 ? 0 : remainder;
    if (expected !== Number(digits[length])) return false;
  }
  return true;
}

/**
 * Shown to an operator who has no reason to see the whole number: only the
 * digits that identify which citizen this is, never the ones a person could
 * reuse elsewhere.
 */
export function maskCpf(value: string): string {
  const d = normalizeCpf(value);
  if (d.length !== 11) return value;
  return `${d.slice(0, 3)}.***.***-${d.slice(9, 11)}`;
}

/** Mask as the citizen types: 123.456.789-09. Presentation only. */
export function formatCpf(value: string): string {
  const d = normalizeCpf(value).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3}\.\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3}\.\d{3}\.\d{3})(\d)/, "$1-$2");
}

/**
 * Phone mask for the mixed contact field: only applied when the value is
 * numeric, so an e-mail passes through untouched.
 */
export function formatPhone(value: string): string {
  if (!/^[\d\s()-]+$/.test(value)) return value;
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  // 10 digits = landline (0000-0000), 11 = mobile (00000-0000).
  const split = d.length === 11 ? 7 : 6;
  return `(${d.slice(0, 2)}) ${d.slice(2, split)}-${d.slice(split)}`;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * One field for e-mail or WhatsApp, as the redesign asks: a citizen who only
 * uses WhatsApp should not have to invent an address to be answered.
 */
export function isValidContact(value: string): boolean {
  const trimmed = value.trim();
  if (EMAIL.test(trimmed)) return true;
  const digits = trimmed.replace(/\D/g, "");
  // Brazilian numbers with area code, mobile or landline.
  return digits.length === 10 || digits.length === 11;
}

/**
 * Whether the mixed contact field holds an e-mail rather than a phone
 * number, conservative on purpose: anything that does not clearly match
 * gets treated as "not an e-mail", so a notification never fires at a
 * malformed address instead of quietly not firing at all.
 */
export function isEmailContact(value: string): boolean {
  return EMAIL.test(value.trim());
}

/**
 * A Brazilian number with area code, mobile or landline. Its own check
 * because the agenda asks for the telephone in its own field, next to a
 * required e-mail, rather than in the either/or field the other channels use.
 */
export function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length === 10 || digits.length === 11;
}

const requiredText = (max: number) =>
  z
    .string()
    .transform((s) => s.trim().replace(/\s+/g, " "))
    .pipe(
      z.string().min(1, "Preencha este campo.").max(max, "Texto longo demais."),
    );

const optionalText = (max: number) =>
  z
    .string()
    // The client only registers the fields the act renders, so a field the
    // act does not ask for arrives as undefined, not "".
    .default("")
    .transform((s) => s.trim().replace(/\s+/g, " "))
    .pipe(z.string().max(max, "Texto longo demais."))
    .transform((s) => (s === "" ? undefined : s));

/**
 * What every filing of a service request asks, whichever counter it comes
 * through. What differs between them is the identification, and only that:
 * the site asks for an e-mail it can write to, the balcão has the citizen
 * standing there and takes whichever contact they have.
 */
const commonFields = {
  applicantName: requiredText(160),
  cpf: z
    .string()
    .transform((s) => normalizeCpf(s))
    .refine((s) => s === "" || isValidCpf(s), {
      message: "CPF inválido.",
    })
    .transform((s) => (s === "" ? undefined : s))
    .optional(),
  description: optionalText(4000),
  purpose: optionalText(500),
  // Never a price: it is what the operator needs to find the band in the
  // court's fee table.
  parameterValue: optionalText(120),
  lgpdConsent: z.coerce.boolean(),
  truthDeclaration: z.coerce.boolean(),
};

/**
 * The rules the act imposes on the fields above. Written against the fields
 * they read rather than against a whole schema, so both filings share one
 * copy: a rule that exists twice is a rule that will be changed once.
 *
 * Two acts ask different questions, and the difference is law, not
 * preference: only the acts that may ask for a purpose carry the field, and
 * "outros" cannot be read without a description.
 */
function actRules(act: Act) {
  return (
    data: {
      lgpdConsent: boolean;
      truthDeclaration: boolean;
      description?: string;
      purpose?: string;
    },
    ctx: z.RefinementCtx,
  ) => {
    if (!data.lgpdConsent) {
      ctx.addIssue({
        code: "custom",
        path: ["lgpdConsent"],
        message: "É necessário autorizar o tratamento dos dados para enviar.",
      });
    }
    if (!data.truthDeclaration) {
      ctx.addIssue({
        code: "custom",
        path: ["truthDeclaration"],
        message: "É necessário declarar que as informações são verdadeiras.",
      });
    }
    if (act.requiresDescription && !data.description) {
      ctx.addIssue({
        code: "custom",
        path: ["description"],
        message: "Descreva o que você precisa para a serventia poder avaliar.",
      });
    }
    if (act.requiresPurpose && !data.purpose) {
      ctx.addIssue({
        code: "custom",
        path: ["purpose"],
        message: "Este ato exige que você informe a finalidade.",
      });
    }
  };
}

/**
 * The filing the citizen makes on the site. Two identification fields, not
 * the either/or the other channels use: a request filed with only a telephone
 * number never received the protocol e-mail nor any andamento notice, because
 * there was no address to send them to. The office answers by telephone, so
 * the number is asked for as well, and it stays optional: nobody is turned
 * away for not having one.
 */
export function publicServiceRequestSchema(act: Act) {
  return z
    .object({
      ...commonFields,
      email: requiredText(160).refine((value) => EMAIL.test(value), {
        message: "Informe um e-mail válido.",
      }),
      phone: optionalText(40).refine(
        (value) => value === undefined || isValidPhone(value),
        { message: "Informe um telefone com DDD." },
      ),
    })
    .superRefine(actRules(act));
}

export type PublicServiceRequestInput = z.infer<
  ReturnType<typeof publicServiceRequestSchema>
>;

/**
 * The filing the operator makes at the counter. The contact stays the either/
 * or field on purpose: the balcão is where someone with no e-mail is served,
 * and it is the operator typing, with the citizen in front of them.
 */
export function serviceRequestSchema(act: Act) {
  return z
    .object({
      ...commonFields,
      contact: requiredText(160).refine(isValidContact, {
        message: "Informe um e-mail válido ou um telefone com DDD.",
      }),
    })
    .superRefine(actRules(act));
}

export type ServiceRequestInput = z.infer<
  ReturnType<typeof serviceRequestSchema>
>;

/**
 * Invisible field no person ever sees, so anything in it came from a script.
 * The office asked for no CAPTCHA: the citizen should not solve a puzzle to
 * ask for a birth certificate.
 */
export function looksLikeBot(honeypot: FormDataEntryValue | null): boolean {
  return typeof honeypot === "string" && honeypot.trim() !== "";
}
