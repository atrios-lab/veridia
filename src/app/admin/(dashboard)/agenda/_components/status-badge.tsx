import { Badge } from "../../../_ui/badge.tsx";

const STATUS_STYLES: Record<string, string> = {
  booked: "border-success/30 bg-success-soft text-success-text",
  attended: "bg-primary text-primary-foreground",
  no_show: "border-warning/30 bg-warning-soft text-warning-text",
  cancelled: "bg-muted text-muted-foreground",
};

/** A desk reservation is a live booking with its own badge: the operator
 * reading the day should know who came through the site and who did not. */
export const DESK_BADGE_STYLE =
  "border-warning/30 bg-warning-soft text-warning-text";

export function AppointmentStatusBadge({
  status,
  label,
}: {
  status: string;
  label: string;
}) {
  return (
    <Badge
      className={STATUS_STYLES[status] ?? "bg-muted text-muted-foreground"}
    >
      {label}
    </Badge>
  );
}
