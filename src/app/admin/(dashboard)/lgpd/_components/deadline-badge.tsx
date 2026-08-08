import {
  DATA_RIGHTS_DEADLINE_DAYS,
  dataRightsDayOfDeadline,
} from "@/core/request/channels.ts";
import type { IsoDate } from "@/core/scheduling/calendar.ts";

/** How close to the legal term counts as "close enough to flag" — the same
 * horizon the Visão geral's "prazos a acompanhar" block uses. */
const DUE_SOON_DAYS = 3;

export type DataRightsUrgency =
  | { kind: "received" }
  | { kind: "due-soon"; daysLeft: number }
  | { kind: "overdue"; daysLate: number }
  | { kind: "answered" }
  | { kind: "cancelled" };

/**
 * What the badge says, for the queue row and the detail header alike. Only
 * `status = "new"` carries a legal term still running: once answered or
 * cancelled, the fifteen days stop mattering. Within the term, "due-soon"
 * only kicks in inside `DUE_SOON_DAYS` of the deadline — further out, the
 * plain "Recebido" status is all the row needs to say.
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

const URGENCY_STYLES: Record<DataRightsUrgency["kind"], string> = {
  received: "bg-admin-readonly-bg text-admin-text",
  "due-soon": "bg-admin-warning-bg text-admin-warning-text",
  overdue: "bg-admin-error-bg text-admin-error-text",
  answered: "bg-admin-success-bg text-admin-success-text",
  cancelled: "bg-admin-readonly-bg text-admin-muted",
};

function urgencyLabel(urgency: DataRightsUrgency): string {
  switch (urgency.kind) {
    case "received":
      return "Recebido";
    case "due-soon":
      return urgency.daysLeft <= 0
        ? "Vence hoje"
        : `Vence em ${urgency.daysLeft} dia${urgency.daysLeft === 1 ? "" : "s"}`;
    case "overdue":
      return `Prazo vencido há ${urgency.daysLate} dia${urgency.daysLate === 1 ? "" : "s"}`;
    case "answered":
      return "Respondido";
    case "cancelled":
      return "Cancelado";
  }
}

export function DeadlineBadge({
  status,
  requestedOn,
  today,
}: {
  status: string;
  requestedOn: IsoDate;
  today: IsoDate;
}) {
  const urgency = dataRightsUrgency(status, requestedOn, today);
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${URGENCY_STYLES[urgency.kind]}`}
    >
      {urgencyLabel(urgency)}
    </span>
  );
}
