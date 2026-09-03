// Relative on purpose: node --test loads this file and knows no "@/".
import type { DeadlineUrgency } from "../../../../../core/overview/urgency.ts";
import {
  isOpenServiceRequestStatus,
  SERVICE_REQUEST_STATUSES,
  type ServiceRequestStatus,
} from "../../../../../core/request/kinds.ts";
import { STATUS_TONES, type Tone } from "./status-tone.ts";

/**
 * The bands the queue is read in, top to bottom: what stalled, what waits for
 * someone to pick it up, what is being worked, what only waits for the
 * citizen to come, and what is over. The same tone that colours the badge
 * decides the band, so a status can never sit under a heading that argues
 * with its colour; the one correction is that anything terminal goes to the
 * end, whatever its tone ("Indeferido" is red, and still over).
 */
export const QUEUE_GROUPS: readonly { id: Tone; label: string }[] = [
  { id: "blocked", label: "Com pendência" },
  { id: "waiting", label: "Aguardando" },
  { id: "working", label: "Em andamento" },
  { id: "delivered", label: "Para retirada" },
  { id: "closed", label: "Encerrados" },
];

export function queueGroupOf(status: ServiceRequestStatus): Tone {
  return isOpenServiceRequestStatus(status) ? STATUS_TONES[status] : "closed";
}

export interface QueueRowOrder {
  group: Tone;
  status: ServiceRequestStatus;
  urgency: DeadlineUrgency;
  createdAt: Date;
}

const GROUP_RANK = new Map(QUEUE_GROUPS.map((g, i) => [g.id, i]));
const URGENCY_RANK: Record<DeadlineUrgency["kind"], number> = {
  overdue: 0,
  "due-soon": 1,
  paused: 2,
  running: 3,
  closed: 4,
};

/**
 * Band first; inside a band the latest term first, then the one closest to
 * its term, then the paused ones with the longest wait on the citizen first
 * (the one closest to lapsing is the one worth a telephone call); ties by
 * arrival, oldest first, which is the order the office promises the citizen
 * it works in. The closed band has no term to read, so
 * it groups by andamento (concluídos together, indeferidos together) and
 * inside each reads newest first: there nobody is queueing, and the last
 * thing finished is the one still being asked about.
 */
export function compareQueueRows(a: QueueRowOrder, b: QueueRowOrder): number {
  const byGroup =
    (GROUP_RANK.get(a.group) ?? 0) - (GROUP_RANK.get(b.group) ?? 0);
  if (byGroup !== 0) return byGroup;
  if (a.group === "closed") {
    const byStatus =
      SERVICE_REQUEST_STATUSES.indexOf(a.status) -
      SERVICE_REQUEST_STATUSES.indexOf(b.status);
    if (byStatus !== 0) return byStatus;
    return b.createdAt.getTime() - a.createdAt.getTime();
  }

  const byUrgency = URGENCY_RANK[a.urgency.kind] - URGENCY_RANK[b.urgency.kind];
  if (byUrgency !== 0) return byUrgency;
  if (a.urgency.kind === "overdue" && b.urgency.kind === "overdue") {
    if (a.urgency.daysLate !== b.urgency.daysLate)
      return b.urgency.daysLate - a.urgency.daysLate;
  }
  if (a.urgency.kind === "due-soon" && b.urgency.kind === "due-soon") {
    if (a.urgency.daysLeft !== b.urgency.daysLeft)
      return a.urgency.daysLeft - b.urgency.daysLeft;
  }
  if (a.urgency.kind === "paused" && b.urgency.kind === "paused") {
    if (a.urgency.waitingDays !== b.urgency.waitingDays)
      return b.urgency.waitingDays - a.urgency.waitingDays;
  }
  return a.createdAt.getTime() - b.createdAt.getTime();
}
