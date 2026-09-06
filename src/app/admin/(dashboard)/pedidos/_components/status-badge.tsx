import type { ServiceRequestStatus } from "@/core/request/kinds.ts";
import { statusBadgeClass } from "./status-tone.ts";

/** Shared between the queue and the detail screen so the two never drift. */
export function StatusBadge({
  status,
  label,
  hero = false,
}: {
  status: ServiceRequestStatus;
  label: string;
  /** The detail screen's header pill: a step up in size, with a dot. */
  hero?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full font-bold ${
        hero
          ? "gap-1.5 px-[11px] py-[5px] text-[12px]"
          : "px-2.5 py-1 text-[11px]"
      } ${statusBadgeClass(status)}`}
    >
      {hero && (
        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      )}
      {label}
    </span>
  );
}
