import { deadlineUrgency } from "@/core/overview/urgency.ts";
import { type Deadline, deadlineDate } from "@/core/request/deadline.ts";
import { formatDate, type IsoDate } from "@/core/scheduling/calendar.ts";

/**
 * How the term stands, said only when it is worth saying. A request with
 * three weeks left says nothing here: the andamento is what the row is for,
 * and a badge on every line is a badge nobody reads.
 *
 * A paused term speaks, in a neutral tone: the office is waiting on the
 * citizen, and how long for is the one number that tells the operator whom
 * to telephone. Red would blame the office for a delay that is not its own.
 *
 * The queue has a Prazo column of its own now, and an empty cell there
 * reads as "no term" rather than as "nothing to flag", so with `showRunning`
 * the quiet case says the expected date in plain text, no pill. The detail
 * screen keeps the old silence.
 *
 * The LGPD queue has its own badge, which always speaks: there the term is
 * the law's and the fifteen days are the point of the screen.
 */
export function DeadlineBadge({
  open,
  deadline,
  today,
  showRunning = false,
}: {
  open: boolean;
  deadline: Deadline;
  today: IsoDate;
  /** Say "Vence em dd/mm" when there is nothing to flag, instead of nothing. */
  showRunning?: boolean;
}) {
  const urgency = deadlineUrgency(open, deadline, today);
  if (urgency.kind === "closed") return null;
  if (urgency.kind === "running") {
    if (!showRunning) return null;
    const due = deadlineDate(deadline.startedOn, deadline.days);
    return (
      <span className="text-[12.5px] whitespace-nowrap text-admin-faint">
        Vence em {formatDate(due).slice(0, 5)}
      </span>
    );
  }

  if (urgency.kind === "paused") {
    return (
      <span className="inline-flex items-center rounded-full bg-admin-readonly-bg px-[9px] py-1 text-[11px] font-bold whitespace-nowrap text-admin-muted">
        {urgency.waitingDays === 0
          ? "Aguardando o cidadão desde hoje"
          : `Aguardando o cidadão há ${urgency.waitingDays} dia${urgency.waitingDays === 1 ? "" : "s"} úte${urgency.waitingDays === 1 ? "l" : "is"}`}
      </span>
    );
  }

  const overdue = urgency.kind === "overdue";
  return (
    <span
      className={`inline-flex items-center rounded-full px-[9px] py-1 text-[11px] font-bold whitespace-nowrap ${
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
