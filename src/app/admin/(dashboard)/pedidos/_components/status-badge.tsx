import type { ServiceRequestStatus } from "@/core/request/kinds.ts";
import { Badge } from "../../../_ui/badge.tsx";
import { cn } from "../../../_ui/cn.ts";
import { statusBadgeClass } from "./status-tone.ts";

/** Shared between the queue and the detail screen so the two never drift. */
export function StatusBadge({
  status,
  label,
  hero = false,
}: {
  status: ServiceRequestStatus;
  label: string;
  /** The detail screen's header pill: a step up in size, with a dot, in
   * solid colour, since it is read from across the screen. */
  hero?: boolean;
}) {
  return (
    <Badge
      className={cn(
        hero && "h-6 gap-1.5 px-2.5 text-xs",
        statusBadgeClass(status, hero),
      )}
    >
      {hero && (
        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      )}
      {label}
    </Badge>
  );
}
