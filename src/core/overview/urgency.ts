import { DATA_RIGHTS_DEADLINE_DAYS } from "../request/channels.ts";
import { dayOfDeadline } from "../request/deadline.ts";
import type { IsoDate } from "../scheduling/calendar.ts";

/** How close to the legal term counts as "close enough to flag": the
 * horizon both the LGPD queue's badge and the Visão geral's mesa use. */
export const DUE_SOON_DAYS = 3;

export type DeadlineUrgency =
  | { kind: "running" }
  | { kind: "due-soon"; daysLeft: number }
  | { kind: "overdue"; daysLate: number }
  | { kind: "closed" };

/**
 * How a term stands today, for any record that carries one. Only a record
 * still open carries a term that matters: once it is answered, concluded or
 * cancelled, the days stop counting. Within the term, "due-soon" only kicks
 * in inside `DUE_SOON_DAYS` of the deadline; further out, the plain status is
 * all the row needs to say.
 */
export function deadlineUrgency(
  open: boolean,
  startedOn: IsoDate,
  days: number,
  today: IsoDate,
): DeadlineUrgency {
  if (!open) return { kind: "closed" };

  const daysLeft = days - dayOfDeadline(startedOn, today);
  if (daysLeft < 0) return { kind: "overdue", daysLate: -daysLeft };
  if (daysLeft <= DUE_SOON_DAYS) return { kind: "due-soon", daysLeft };
  return { kind: "running" };
}

export type DataRightsUrgency =
  | { kind: "received" }
  | { kind: "due-soon"; daysLeft: number }
  | { kind: "overdue"; daysLate: number }
  | { kind: "answered" }
  | { kind: "cancelled" };

/**
 * What the badge says, for the queue row, the detail header and the mesa de
 * trabalho alike. The counting is `deadlineUrgency`'s; what this adds is the
 * channel's own vocabulary, which names the two closed outcomes apart.
 */
export function dataRightsUrgency(
  status: string,
  requestedOn: IsoDate,
  today: IsoDate,
): DataRightsUrgency {
  if (status === "answered") return { kind: "answered" };
  if (status === "cancelled") return { kind: "cancelled" };

  const urgency = deadlineUrgency(
    true,
    requestedOn,
    DATA_RIGHTS_DEADLINE_DAYS,
    today,
  );
  // "closed" cannot come back from an open record; the two andamentos that
  // close this channel are named above, in the channel's own words.
  if (urgency.kind === "closed" || urgency.kind === "running") {
    return { kind: "received" };
  }
  return urgency;
}
