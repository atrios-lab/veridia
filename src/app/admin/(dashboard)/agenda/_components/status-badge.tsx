const STATUS_STYLES: Record<string, string> = {
  booked: "bg-admin-success-bg text-admin-success-text",
  attended: "bg-admin-primary text-white",
  no_show: "bg-admin-warning-bg text-admin-warning-text",
  cancelled: "bg-admin-readonly-bg text-admin-muted",
};

/** A desk reservation is a live booking with its own badge: the operator
 * reading the day should know who came through the site and who did not. */
export const DESK_BADGE_STYLE = "bg-admin-warning-bg text-admin-warning-text";

export function AppointmentStatusBadge({
  status,
  label,
}: {
  status: string;
  label: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${
        STATUS_STYLES[status] ?? "bg-admin-readonly-bg text-admin-muted"
      }`}
    >
      {label}
    </span>
  );
}
