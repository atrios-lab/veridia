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
 * The form as the act shapes it. Two acts ask different questions, and the
 * difference is law, not preference: only the acts that may ask for a purpose
 * carry the field, and "outros" cannot be read without a description.
 */
export function serviceRequestSchema(act: Act) {
  return z
    .object({
      applicantName: requiredText(160),
      contact: requiredText(160).refine(isValidContact, {
        message: "Informe um e-mail válido ou um telefone com DDD.",
      }),
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
    })
    .refine((data) => data.lgpdConsent, {
      path: ["lgpdConsent"],
      message: "É necessário autorizar o tratamento dos dados para enviar.",
    })
    .refine((data) => data.truthDeclaration, {
      path: ["truthDeclaration"],
      message: "É necessário declarar que as informações são verdadeiras.",
    })
    .refine((data) => !act.requiresDescription || Boolean(data.description), {
      path: ["description"],
      message: "Descreva o que você precisa para a serventia poder avaliar.",
    })
    .refine((data) => !act.requiresPurpose || Boolean(data.purpose), {
      path: ["purpose"],
      message: "Este ato exige que você informe a finalidade.",
    });
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
