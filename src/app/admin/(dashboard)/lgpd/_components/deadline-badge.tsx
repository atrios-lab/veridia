import {
  type DataRightsUrgency,
  dataRightsUrgency,
} from "@/core/overview/urgency.ts";
import type { IsoDate } from "@/core/scheduling/calendar.ts";
import { Badge } from "../../../_ui/badge.tsx";

// A term about to end, or already over, is a badge that has to be seen:
// solid colour, not a tint (decision of 11/11/2026).
const URGENCY_STYLES: Record<DataRightsUrgency["kind"], string> = {
  received: "bg-muted text-foreground",
  "due-soon": "bg-warning text-warning-foreground",
  overdue: "bg-destructive text-destructive-foreground",
  answered: "border-success/30 bg-success-soft text-success-text",
  cancelled: "bg-muted text-muted-foreground",
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
    <Badge className={URGENCY_STYLES[urgency.kind]}>
      {urgencyLabel(urgency)}
    </Badge>
  );
}
