const STATUS_STYLES: Record<string, string> = {
  booked: "bg-admin-success-bg text-admin-success-text",
  attended: "bg-admin-primary text-white",
  cancelled: "bg-admin-readonly-bg text-admin-muted",
};

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
