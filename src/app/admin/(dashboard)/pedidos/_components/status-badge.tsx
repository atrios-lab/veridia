import type { ServiceRequestStatus } from "@/core/request/kinds.ts";

/**
 * One look per andamento, shared between the queue and the detail screen so
 * the two never drift into naming the same status two different colours.
 */
const STATUS_STYLES: Record<ServiceRequestStatus, string> = {
  new: "bg-admin-warning-bg text-admin-warning-text",
  "in-review": "bg-admin-success-bg text-admin-success-text",
  "awaiting-payment": "bg-admin-warning-bg text-admin-warning-text",
  paid: "bg-admin-success-bg text-admin-success-text",
  done: "bg-admin-primary text-white",
  rejected: "bg-admin-error-bg text-admin-error-text",
  cancelled: "bg-admin-readonly-bg text-admin-muted",
  archived: "bg-admin-readonly-bg text-admin-faint",
};

export function StatusBadge({
  status,
  label,
}: {
  status: ServiceRequestStatus;
  label: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_STYLES[status]}`}
    >
      {label}
    </span>
  );
}
