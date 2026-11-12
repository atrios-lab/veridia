import { deadlineUrgency } from "@/core/overview/urgency.ts";
import { type Deadline, deadlineDate } from "@/core/request/deadline.ts";
import {
  formatDate,
  type IsoDate,
  type OfficeHolidays,
} from "@/core/scheduling/calendar.ts";
import { Badge } from "../../../_ui/badge.tsx";

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
  holidays,
  showRunning = false,
}: {
  open: boolean;
  deadline: Deadline;
  today: IsoDate;
  /** The office's own days off (`officeHolidays(tenant)`): they are not
   * business days, so they count toward no term. */
  holidays: OfficeHolidays;
  /** Say "Vence em dd/mm" when there is nothing to flag, instead of nothing. */
  showRunning?: boolean;
}) {
  const urgency = deadlineUrgency(open, deadline, today, holidays);
  if (urgency.kind === "closed") return null;
  if (urgency.kind === "running") {
    if (!showRunning) return null;
    const due = deadlineDate(deadline.startedOn, deadline.days, holidays);
    return (
      <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
        Vence em {formatDate(due).slice(0, 5)}
      </span>
    );
  }

  if (urgency.kind === "paused") {
    return (
      <Badge className="bg-muted text-muted-foreground">
        {urgency.waitingDays === 0
          ? "Aguardando o cidadão desde hoje"
          : `Aguardando o cidadão há ${urgency.waitingDays} dia${urgency.waitingDays === 1 ? "" : "s"} úte${urgency.waitingDays === 1 ? "l" : "is"}`}
      </Badge>
    );
  }

  const overdue = urgency.kind === "overdue";
  return (
    // Late or due within days: the badge the row is scanned for, so it is
    // solid ("destaque é cor cheia"), red when late and amber when close.
    <Badge
      className={
        overdue
          ? "bg-destructive text-destructive-foreground"
          : "bg-warning text-warning-foreground"
      }
    >
      {overdue
        ? `Prazo vencido há ${urgency.daysLate} dia${urgency.daysLate === 1 ? "" : "s"}`
        : urgency.daysLeft <= 0
          ? "Vence hoje"
          : `Vence em ${urgency.daysLeft} dia${urgency.daysLeft === 1 ? "" : "s"}`}
    </Badge>
  );
}
