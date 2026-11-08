import { deadlineDate } from "../request/deadline.ts";
import {
  addDays,
  type IsoDate,
  isBusinessDay,
} from "../scheduling/calendar.ts";

/**
 * How the law makes an edital run: how many times it is published, how far
 * apart, and the term that follows. Pure data, read by `noticeSchedule`; the
 * catalog of which edital follows which rule is `notice-types.ts`.
 */
export interface NoticeRunRule {
  /** How many times the edital is published (1, 2 or 3). */
  runs: number;
  /**
   * Days from one run to the next: 15 when each run lasts fifteen days
   * (usucapião, art. 216-A § 13), 1 when the law asks for consecutive days
   * (loteamento, Lei 6.766 art. 19). One means the next calendar day;
   * anything longer is counted like the term, in `counting`. Ignored on a
   * single run.
   */
  runIntervalDays: number;
  /**
   * Days after the last run before the term starts counting: 10 in the
   * intimação of Lei 6.766 art. 49 § 2º, zero everywhere else.
   */
  graceDays: number;
  /** The term itself, counted from the last run plus `graceDays`. */
  termDays: number;
  /** "calendar": dias corridos. "business": dias úteis. */
  counting: "calendar" | "business";
}

export interface NoticeRun {
  /** 1-based: "1ª publicação", "2ª publicação". */
  number: number;
  date: IsoDate;
}

export interface NoticeSchedule {
  runs: NoticeRun[];
  /** The day the term starts counting from (excluded from the count). */
  termStartsAfter: IsoDate;
  /** The last day of the term: the day the edital can leave the site. */
  termEndsOn: IsoDate;
}

/**
 * Every date an edital's rule implies, from its first publication.
 *
 * Counting follows CPC art. 224 (and Código Civil art. 132 for calendar
 * days): the start day excluded, the due day included, and a due day that
 * is not a business day moves to the next one.
 *
 * National holidays only (see `nationalHolidays`): a term ending on a
 * municipal or state holiday reads one day early, which the operator can
 * correct on the exit date before saving.
 */
export function noticeSchedule(
  rule: NoticeRunRule,
  firstRun: IsoDate,
): NoticeSchedule {
  const runs: NoticeRun[] = [{ number: 1, date: firstRun }];
  for (let n = 2; n <= rule.runs; n++) {
    const previous = runs[runs.length - 1].date;
    runs.push({
      number: n,
      date:
        rule.runIntervalDays <= 1
          ? addDays(previous, rule.runIntervalDays)
          : endOfTerm(previous, rule.runIntervalDays, rule.counting),
    });
  }
  const lastRun = runs[runs.length - 1].date;
  const termStartsAfter = addDays(lastRun, rule.graceDays);
  const termEndsOn = endOfTerm(termStartsAfter, rule.termDays, rule.counting);
  return { runs, termStartsAfter, termEndsOn };
}

/**
 * The run on the site today: the latest one whose date has arrived. A second
 * run is a republication, so the site dates the edital from it, not from the
 * first. Undefined before the first run.
 */
export function currentRun(
  schedule: NoticeSchedule,
  today: IsoDate,
): NoticeRun | undefined {
  return schedule.runs.filter((run) => run.date <= today).at(-1);
}

/** `days` after `from` (excluded), landing on a business day either way. */
function endOfTerm(
  from: IsoDate,
  days: number,
  counting: NoticeRunRule["counting"],
): IsoDate {
  return counting === "business"
    ? nextBusinessDayFrom(deadlineDate(from, days))
    : nextBusinessDayFrom(addDays(from, days));
}

// A run of holidays never reaches a fortnight; the cap only guards the loop.
const MAX_SCAN_DAYS = 15;

function nextBusinessDayFrom(date: IsoDate): IsoDate {
  let cursor = date;
  for (let step = 0; step < MAX_SCAN_DAYS && !isBusinessDay(cursor); step++) {
    cursor = addDays(cursor, 1);
  }
  return cursor;
}
