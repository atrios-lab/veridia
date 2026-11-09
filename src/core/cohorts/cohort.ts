import { z } from "zod";
import {
  addDays,
  fromZonedDateTime,
  type IsoDate,
  toIsoDate,
} from "../scheduling/calendar.ts";
import { OFFICE_TIME_ZONE } from "../time/office-time.ts";

// A course cohort without a database: its link code, whether the link
// still takes sign-ups, what the platform account types to create or edit
// one, and what a learner types to join.

/** Crockford base32 without I, L, O and U, the certificate code's alphabet. */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/**
 * XXXX-XXXX from 40 random bits (`bytes` holds at least 5, from
 * `crypto.randomBytes`). Short enough to read over the phone, long enough
 * that guessing a live one is hopeless with the sign-up's rate limit.
 */
export function cohortCode(bytes: Uint8Array): string {
  const bit = (b: number) => ((bytes[b >> 3] ?? 0) >> (7 - (b & 7))) & 1;
  let out = "";
  for (let i = 0; i < 8; i++) {
    let value = 0;
    for (let j = 0; j < 5; j++) value = (value << 1) | bit(i * 5 + j);
    out += ALPHABET[value];
  }
  return `${out.slice(0, 4)}-${out.slice(4, 8)}`;
}

/**
 * A code as typed or pasted, or null: any case, with or without the hyphen,
 * and the usual misreadings decoded the Crockford way (O as 0, I and L as 1).
 */
export function normalizeCohortCode(value: string): string | null {
  const plain = value
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  if (plain.length !== 8) return null;
  for (const char of plain) if (!ALPHABET.includes(char)) return null;
  return `${plain.slice(0, 4)}-${plain.slice(4, 8)}`;
}

/** How long a new link lasts unless the form says otherwise (decided with
 * the user on 09/11/2026). */
export const DEFAULT_COHORT_DAYS = 30;

/**
 * The instant a link stops working when it is valid through `lastDay`: the
 * office's midnight after it. A link "valid through the 9th" still works at
 * 23:00 on the 9th in Natal, whatever zone the server runs in.
 */
export function expiryAfter(lastDay: IsoDate): Date {
  return fromZonedDateTime(`${addDays(lastDay, 1)}T00:00`, OFFICE_TIME_ZONE);
}

/** The last day a link works, on the office's calendar: what the screen
 * shows as "vale até". */
export function lastValidDay(expiresAt: Date): IsoDate {
  return toIsoDate(new Date(expiresAt.getTime() - 1), OFFICE_TIME_ZONE);
}

export type CohortState = "open" | "closed" | "expired" | "full";

/**
 * Whether the link takes a sign-up now. Closing by hand wins over the date,
 * and the date over the seats: the reason shown is the one the platform
 * account would act on first.
 */
export function cohortState(
  cohort: { seats: number; expiresAt: Date; closedAt: Date | null },
  memberCount: number,
  now: Date,
): CohortState {
  if (cohort.closedAt) return "closed";
  if (now.getTime() >= cohort.expiresAt.getTime()) return "expired";
  if (memberCount >= cohort.seats) return "full";
  return "open";
}

export const COHORT_STATE_LABELS: Record<CohortState, string> = {
  open: "Aberta",
  closed: "Encerrada",
  expired: "Vencida",
  full: "Sem vagas",
};

const trimmed = (min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .transform((value) => value.replace(/\s+/g, " "))
    .pipe(z.string().min(min, message).max(max, `Use até ${max} caracteres.`));

const seats = z.coerce
  .number("Informe o número de vagas.")
  .int("Use um número inteiro.")
  .min(1, "A turma precisa de pelo menos 1 vaga.")
  .max(500, "Use até 500 vagas.");

/** What the platform account fills in for a new cohort. */
export const cohortCreateSchema = z.object({
  courseId: z.uuid("Escolha o curso."),
  officeName: trimmed(3, 120, "Informe o nome do cartório."),
  officeCity: trimmed(2, 80, "Informe a cidade."),
  contactName: trimmed(2, 80, "Informe o nome do responsável."),
  contactPhone: trimmed(8, 30, "Informe o telefone do responsável."),
  seats,
  validDays: z.coerce
    .number("Informe a validade em dias.")
    .int("Use um número inteiro.")
    .min(1, "A validade é de pelo menos 1 dia.")
    .max(365, "Use até 365 dias."),
});
export type CohortCreateInput = z.output<typeof cohortCreateSchema>;

/** What the platform account may change afterwards. The course stays: the
 * learners already in it are its learners. */
export const cohortUpdateSchema = z.object({
  officeName: trimmed(3, 120, "Informe o nome do cartório."),
  officeCity: trimmed(2, 80, "Informe a cidade."),
  contactName: trimmed(2, 80, "Informe o nome do responsável."),
  contactPhone: trimmed(8, 30, "Informe o telefone do responsável."),
  seats,
  lastDay: z.iso.date("Informe até quando o link vale."),
});
export type CohortUpdateInput = z.output<typeof cohortUpdateSchema>;

/** Fewer seats than learners would leave a cohort "full" forever and say
 * something false about the ones already in. */
export function seatsFit(seats: number, memberCount: number): boolean {
  return seats >= memberCount;
}

/** What a learner types on the cohort's link. */
export const cohortJoinSchema = z.object({
  fullName: z
    .string()
    .trim()
    .transform((value) => value.replace(/\s+/g, " "))
    .pipe(
      z
        .string()
        .max(120, "O nome passa de 120 caracteres.")
        .refine(
          (value) => value.split(" ").length >= 2,
          "Informe o nome completo.",
        ),
    ),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Informe um e-mail válido.")),
  // The auth library's own bounds: a shorter one would be refused at login.
  password: z
    .string()
    .min(8, "A senha precisa de pelo menos 8 caracteres.")
    .max(128, "A senha passa de 128 caracteres."),
  contactConsent: z.boolean(),
});
export type CohortJoinInput = z.output<typeof cohortJoinSchema>;
