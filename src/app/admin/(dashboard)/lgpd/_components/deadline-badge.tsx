import {
  type DataRightsUrgency,
  dataRightsUrgency,
} from "@/core/overview/urgency.ts";
import type { IsoDate } from "@/core/scheduling/calendar.ts";

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
