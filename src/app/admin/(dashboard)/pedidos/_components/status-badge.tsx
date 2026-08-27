import type { ServiceRequestStatus } from "@/core/request/kinds.ts";
import { statusBadgeClass } from "./status-tone.ts";

/** Shared between the queue and the detail screen so the two never drift. */
export function StatusBadge({
  status,
  label,
}: {
  status: ServiceRequestStatus;
  label: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${statusBadgeClass(status)}`}
    >
      {label}
    </span>
  );
}
