import { z } from "zod";
import { addDays, type IsoDate } from "../scheduling/calendar.ts";

/**
 * The term a record is expected to be answered within: a start day and a
 * number of running days. Two channels count one: the data rights channel,
 * whose fifteen days are the law's and cannot move, and the service request,
 * whose term the office sets and resets as the work demands.
 *
 * Running days, not working days: the office itself says the term "depends on
 * the demand", so a holiday calendar would add precision the number does not
 * have.
 */

/** The last day of the term, counting the start day as day 1. */
export function deadlineDate(startedOn: IsoDate, days: number): IsoDate {
  return addDays(startedOn, days);
}

/**
 * Which day of the term today is, counting the start day as day 1. Past the
 * term it keeps counting: a count that stopped at the last day would hide
 * exactly the case that matters.
 */
export function dayOfDeadline(startedOn: IsoDate, today: IsoDate): number {
  const elapsed = Math.round(
    (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${startedOn}T00:00:00Z`)) /
      86_400_000,
  );
  return Math.max(1, elapsed + 1);
}

/** Bounds shared by the per-record term and the office's default. */
export const MIN_DEADLINE_DAYS = 1;
export const MAX_DEADLINE_DAYS = 365;

export const deadlineDaysSchema = z
  .number()
  .int()
  .min(MIN_DEADLINE_DAYS, "O prazo deve ser de pelo menos 1 dia.")
  .max(MAX_DEADLINE_DAYS, "O prazo deve ser de no máximo 365 dias.");

export const deadlineSchema = z.object({
  startedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  days: deadlineDaysSchema,
});
export type Deadline = z.infer<typeof deadlineSchema>;

/**
 * The term stored on a record, read from the raw `details` blob. Anything
 * malformed reads as "no term of its own", which falls back to the office's
 * default: a corrupted blob must not be able to take the screen down over a
 * line that only says how long something takes.
 */
export function readDeadline(details: unknown): Deadline | undefined {
  const value = (details as { deadline?: unknown } | null)?.deadline;
  const parsed = deadlineSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

/**
 * The term actually in force for a service request. A request only carries a
 * term of its own once the office has moved it; until then the term is the
 * office's default counted from the day the request was filed, which is what
 * gives every request filed before this existed a term for free.
 *
 * The consequence is deliberate: changing the office's default moves the term
 * of every request nobody has touched. That is the honest reading of "the
 * default changed", and the office pins a particular request by setting its
 * term.
 */
export function effectiveDeadline(
  filedOn: IsoDate,
  stored: Deadline | undefined,
  defaultDays: number,
): Deadline {
  return stored ?? { startedOn: filedOn, days: defaultDays };
}
