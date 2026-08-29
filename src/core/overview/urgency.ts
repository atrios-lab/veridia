import {
  DATA_RIGHTS_DEADLINE_DAYS,
  dataRightsDayOfDeadline,
} from "../request/channels.ts";
import { businessDaysBetween, deadlineDate } from "../request/deadline.ts";
import type { IsoDate } from "../scheduling/calendar.ts";

/** How close to the term counts as "close enough to flag": the horizon the
 * LGPD queue's badge, the pedidos queue and the Visão geral's mesa use. */
export const DUE_SOON_DAYS = 3;

export type DeadlineUrgency =
  | { kind: "running" }
  | { kind: "due-soon"; daysLeft: number }
  | { kind: "overdue"; daysLate: number }
  | { kind: "closed" };

/**
 * How a service request's term stands today. Only a record still open carries
 * a term that matters: once concluded, refused, cancelled or filed away, the
 * days stop counting.
 *
 * Business days throughout, the same counting that set the expected date (see
 * core/request/deadline.ts), so "vence em 2 dias" means two days the office
 * actually opens.
 */
export function deadlineUrgency(
  open: boolean,
  startedOn: IsoDate,
  days: number,
  today: IsoDate,
): DeadlineUrgency {
  if (!open) return { kind: "closed" };

  const due = deadlineDate(startedOn, days);
  if (today > due) {
    return { kind: "overdue", daysLate: businessDaysBetween(due, today) };
  }
  const daysLeft = businessDaysBetween(today, due);
  return daysLeft <= DUE_SOON_DAYS
    ? { kind: "due-soon", daysLeft }
    : { kind: "running" };
}

export type DataRightsUrgency =
  | { kind: "received" }
  | { kind: "due-soon"; daysLeft: number }
  | { kind: "overdue"; daysLate: number }
  | { kind: "answered" }
  | { kind: "cancelled" };

/**
 * What the badge says, for the LGPD queue row, the detail header and the mesa
 * de trabalho alike. Its own counting, in calendar days: these fifteen are
 * Lei 13.709's, and the extrajudicial business-day rule does not reach them.
 */
export function dataRightsUrgency(
  status: string,
  requestedOn: IsoDate,
  today: IsoDate,
): DataRightsUrgency {
  if (status === "answered") return { kind: "answered" };
  if (status === "cancelled") return { kind: "cancelled" };

  const dayOfTerm = dataRightsDayOfDeadline(requestedOn, today);
  const daysLeft = DATA_RIGHTS_DEADLINE_DAYS - dayOfTerm;
  if (daysLeft < 0) return { kind: "overdue", daysLate: -daysLeft };
  if (daysLeft <= DUE_SOON_DAYS) return { kind: "due-soon", daysLeft };
  return { kind: "received" };
}
