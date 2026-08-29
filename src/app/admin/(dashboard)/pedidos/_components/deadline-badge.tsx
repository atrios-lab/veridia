import { deadlineUrgency } from "@/core/overview/urgency.ts";
import type { IsoDate } from "@/core/scheduling/calendar.ts";

/**
 * How the term stands, said only when it is worth saying. A request with
 * three weeks left says nothing here: the andamento is what the row is for,
 * and a badge on every line is a badge nobody reads.
 *
 * The LGPD queue has its own badge, which always speaks: there the term is
 * the law's and the fifteen days are the point of the screen.
 */
export function DeadlineBadge({
  open,
  startedOn,
  days,
  today,
}: {
  open: boolean;
  startedOn: IsoDate;
  days: number;
  today: IsoDate;
}) {
  const urgency = deadlineUrgency(open, startedOn, days, today);
  if (urgency.kind === "running" || urgency.kind === "closed") return null;

  const overdue = urgency.kind === "overdue";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${
        overdue
          ? "bg-admin-error-bg text-admin-error-text"
          : "bg-admin-warning-bg text-admin-warning-text"
      }`}
    >
      {overdue
        ? `Prazo vencido há ${urgency.daysLate} dia${urgency.daysLate === 1 ? "" : "s"}`
        : urgency.daysLeft <= 0
          ? "Vence hoje"
          : `Vence em ${urgency.daysLeft} dia${urgency.daysLeft === 1 ? "" : "s"}`}
    </span>
  );
}
