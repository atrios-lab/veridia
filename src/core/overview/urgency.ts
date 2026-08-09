import {
  DATA_RIGHTS_DEADLINE_DAYS,
  dataRightsDayOfDeadline,
} from "../request/channels.ts";
import type { IsoDate } from "../scheduling/calendar.ts";

/** How close to the legal term counts as "close enough to flag": the
 * horizon both the LGPD queue's badge and the Visão geral's mesa use. */
export const DUE_SOON_DAYS = 3;

export type DataRightsUrgency =
  | { kind: "received" }
  | { kind: "due-soon"; daysLeft: number }
  | { kind: "overdue"; daysLate: number }
  | { kind: "answered" }
  | { kind: "cancelled" };

/**
 * What the badge says, for the queue row, the detail header and the mesa de
 * trabalho alike. Only `status = "new"` carries a legal term still running:
 * once answered or cancelled, the fifteen days stop mattering. Within the
 * term, "due-soon" only kicks in inside `DUE_SOON_DAYS` of the deadline;
 * further out, the plain "Recebido" status is all the row needs to say.
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
