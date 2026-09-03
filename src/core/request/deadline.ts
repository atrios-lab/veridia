import { z } from "zod";
import {
  addDays,
  type IsoDate,
  isBusinessDay,
} from "../scheduling/calendar.ts";

/**
 * The term a record is expected to be answered within: a start day and a
 * number of days. Two channels count one: the data rights channel, whose
 * fifteen days are the law's and cannot move, and the service request, whose
 * term is born from the act's own legal term and which the office resets as
 * the work demands.
 *
 * Counted in business days, the day of filing excluded and the due day
 * included, which is how Lei 14.382/2022 has the extrajudicial terms counted
 * (business days and hours, following the civil procedure rules) and how
 * Lei 9.492 art. 12 counts the protest.
 *
 * One counting for every act, including the ones the business-day rule does
 * not name (registro civil das pessoas naturais, notas). Two engines would be
 * two things to get wrong, and counting an act's term in business days when
 * the law would count it straight only ever puts the expected date later than
 * the law does: the office promises no earlier than it must, and the screen
 * never calls a record late while the law still considers it on time.
 *
 * Municipal and state holidays are not known here (see `nationalHolidays`),
 * so a term falling on one reads as a business day.
 */

// A term never legitimately walks past this; the cap is what keeps a corrupted
// number from spinning a loop rather than a business rule.
const MAX_SCAN_DAYS = 3000;

/** The last day of a term of `days` business days, the start day excluded. */
export function deadlineDate(startedOn: IsoDate, days: number): IsoDate {
  let cursor = startedOn;
  let counted = 0;
  for (let step = 0; step < MAX_SCAN_DAYS && counted < days; step++) {
    cursor = addDays(cursor, 1);
    if (isBusinessDay(cursor)) counted++;
  }
  return cursor;
}

/**
 * Business days in `(from, to]`: the start day excluded, the end day counted
 * when it is a business day. Zero when `to` is not after `from`.
 */
export function businessDaysBetween(from: IsoDate, to: IsoDate): number {
  if (to <= from) return 0;
  let cursor = from;
  let counted = 0;
  for (let step = 0; step < MAX_SCAN_DAYS && cursor < to; step++) {
    cursor = addDays(cursor, 1);
    if (isBusinessDay(cursor)) counted++;
  }
  return counted;
}

/**
 * Which business day of the term today is, the day of filing being day zero:
 * on the day a request is filed nothing of the term has run yet. Past the
 * term it keeps counting, which is exactly the case that matters.
 */
export function dayOfDeadline(startedOn: IsoDate, today: IsoDate): number {
  return businessDaysBetween(startedOn, today);
}

/**
 * Said next to every expected date the citizen is shown, on the filing screen
 * and on the consult alike. The term is what the office works to, not a date
 * it sells: requests are taken in the order they arrive, and the office asked
 * for that to be on the screen rather than discovered by telephone.
 */
export const DEADLINE_CAVEAT =
  "A previsão pode mudar: os pedidos são atendidos por ordem de chegada.";

/** Bounds shared by the per-record term and the office's own default. */
export const MIN_DEADLINE_DAYS = 1;
export const MAX_DEADLINE_DAYS = 365;

export const deadlineDaysSchema = z
  .number()
  .int()
  .min(MIN_DEADLINE_DAYS, "O prazo deve ser de pelo menos 1 dia.")
  .max(MAX_DEADLINE_DAYS, "O prazo deve ser de no máximo 365 dias.");

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const deadlineSchema = z.object({
  startedOn: isoDate,
  days: deadlineDaysSchema,
  // The day the clock stopped, while the citizen owes the office something
  // (see `pauseReasons`). Absent means the term is running.
  pausedOn: isoDate.optional(),
});
export type Deadline = z.infer<typeof deadlineSchema>;

/**
 * What stops the office's clock: the citizen still owes an answer to a
 * written exigência (Lei 6.015 art. 198), or a payment the office already
 * priced. Each reason needs its lastro: the andamento alone ("Aguardando
 * exigência" with nothing registered, "Aguardando pagamento" with no value)
 * pauses nothing, because a term paused on a label is a term paused on a
 * whim.
 */
export type PauseReason = "requirement" | "payment";

export function pauseReasons(request: {
  status: string;
  amountCents: number | null;
  pendingRequirements: number;
}): PauseReason[] {
  const reasons: PauseReason[] = [];
  if (request.pendingRequirements > 0) reasons.push("requirement");
  if (request.status === "awaiting-payment" && request.amountCents != null) {
    reasons.push("payment");
  }
  return reasons;
}

/**
 * The day the counting reads as "today": the real one while the term runs,
 * the day it stopped while paused. Every "dia X de N" the screens print
 * goes through here so a paused request reads the same tomorrow.
 */
export function deadlineClock(deadline: Deadline, today: IsoDate): IsoDate {
  return deadline.pausedOn ?? today;
}

/**
 * The term once the last reason to pause is gone. Where the law fixes the
 * act's term, the counting restarts on the day of the retomada: that is how
 * the norms read the reapresentação of a title (prazo contado do reingresso),
 * and the screen never calls late what the law still considers on time.
 * Where only the office's default applies, no law gives a new term, so the
 * counting resumes where it stopped: the expected date moves forward by the
 * business days the pause lasted.
 */
export function resumeDeadline(
  deadline: Deadline,
  today: IsoDate,
  hasLegalTerm: boolean,
): Deadline {
  const { pausedOn, ...running } = deadline;
  if (!pausedOn) return running;
  if (hasLegalTerm) return { startedOn: today, days: running.days };
  return {
    startedOn: deadlineDate(
      running.startedOn,
      businessDaysBetween(pausedOn, today),
    ),
    days: running.days,
  };
}

/**
 * The term stored on a record, read from the raw `details` blob. Anything
 * malformed reads as "no term of its own", which falls back to the act's
 * legal term: a corrupted blob must not be able to take the screen down over
 * a line that only says how long something takes.
 */
export function readDeadline(details: unknown): Deadline | undefined {
  const value = (details as { deadline?: unknown } | null)?.deadline;
  const parsed = deadlineSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

/**
 * The term actually in force for a service request, in the order the office
 * asked for: what the office set on this request, else the act's own legal
 * term, else the office's default for the acts the law fixes no term for.
 *
 * A request only carries a term of its own once the office has moved it,
 * which is what gives every request filed before any of this a term for free.
 */
export function effectiveDeadline(
  filedOn: IsoDate,
  stored: Deadline | undefined,
  legalDays: number | undefined,
  officeDefaultDays: number,
): Deadline {
  return stored ?? { startedOn: filedOn, days: legalDays ?? officeDefaultDays };
}
