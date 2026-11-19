import Link from "next/link";
import type { DeskChipTone, RankedDeskItem } from "@/core/overview/desk.ts";
import { AdminIcon } from "../../_components/icon.tsx";
import { Badge } from "../../_ui/badge.tsx";
import { buttonVariants } from "../../_ui/button.tsx";
import { cn } from "../../_ui/cn.ts";

const CHIP_STYLES: Record<DeskChipTone, string> = {
  error: "bg-destructive text-destructive-foreground",
  warning: "bg-warning text-warning-foreground",
  neutral: "bg-muted text-muted-foreground",
};

/** The next-step button reads the same urgency as the chip: filled red for
 * what can't wait, filled navy for what's next, an outline for routine
 * work that isn't going anywhere. */
const ACTION_VARIANTS = {
  error: "destructive-solid",
  warning: "default",
  neutral: "outline",
} as const satisfies Record<DeskChipTone, string>;

/** The left edge of each item, in the urgency's colour. */
const EDGE_STYLES: Record<DeskChipTone, string> = {
  error: "border-l-destructive",
  warning: "border-l-primary",
  neutral: "border-l-border",
};

/** What the desk says at a glance (decision of 19/11/2026): the header
 * takes the colour of the moment instead of a stripe on the card's edge.
 * "clear" is the good outcome and stays still; only "work" and "critical"
 * pulse, so a pulse keeps meaning "act". */
type DeskState = "clear" | "work" | "critical";

const STATE_STYLES: Record<
  DeskState,
  {
    header: string;
    icon: string;
    number: string;
    status: string;
    dot: string;
  }
> = {
  clear: {
    header: "bg-gradient-to-r from-success/12 via-success/4 via-55% to-card",
    icon: "bg-success text-success-foreground",
    number: "text-success",
    status: "border-success/30 text-success-text",
    dot: "text-success",
  },
  work: {
    header: "bg-gradient-to-r from-primary-soft via-primary/3 via-55% to-card",
    icon: "bg-primary text-primary-foreground",
    number: "text-primary",
    status: "border-primary/25 text-primary",
    dot: "text-primary motion-safe:animate-dot-pulse",
  },
  critical: {
    header:
      "bg-gradient-to-r from-destructive/12 via-destructive/4 via-55% to-card",
    icon: "bg-destructive text-destructive-foreground",
    number: "text-destructive",
    status: "border-destructive/30 text-destructive",
    dot: "text-destructive motion-safe:animate-dot-pulse",
  },
};

const STATE_ICONS = {
  clear: "check",
  work: "inbox",
  critical: "alert",
} as const satisfies Record<DeskState, string>;

function deskState(totalCount: number, criticalCount: number): DeskState {
  if (criticalCount > 0) return "critical";
  return totalCount > 0 ? "work" : "clear";
}

/** The status line, split where a phone cuts it: `rest` only shows from
 * the tablet up, so the line stays on one row on a narrow screen. */
function statusLine(
  state: DeskState,
  totalCount: number,
  criticalCount: number,
): { lead: string; rest?: string } {
  if (state === "critical") {
    return {
      lead: `${criticalCount} com prazo crítico`,
      rest: `: comece por ${criticalCount === 1 ? "ele" : "eles"}`,
    };
  }
  if (state === "work") {
    return {
      lead: `${totalCount} ${totalCount === 1 ? "item aguarda" : "itens aguardam"} o cartório`,
      rest: ", do mais urgente ao menos urgente",
    };
  }
  return { lead: "Mesa em dia", rest: ": nada aguarda o cartório agora" };
}

export function DeskList({
  items,
  totalCount,
  criticalCount,
  awaitingCitizen,
  nextAppointmentTime,
}: {
  items: RankedDeskItem[];
  /** Every item awaiting the office, not just the ones the desk has room
   * for: what the ranking cut has to stay countable, or an operator reads a
   * full desk as the whole workload. Items waiting on the citizen are not
   * counted here, so the notice never points at work the desk would not
   * show either. */
  totalCount: number;
  /** Items whose legal term is near or past: they turn the desk red. */
  criticalCount: number;
  /** Open requests whose next move is the citizen's (exigência or payment),
   * shown under a clear desk as what comes next. */
  awaitingCitizen: number;
  /** "09:00" of the day's next appointment, or null. */
  nextAppointmentTime: string | null;
}) {
  const hidden = totalCount - items.length;
  const state = deskState(totalCount, criticalCount);
  const style = STATE_STYLES[state];
  const status = statusLine(state, totalCount, criticalCount);
  // In plain sight (decision of 12/11/2026): the desk is the reason the
  // screen exists. Each row is one link, the whole width, to its next step.
  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-xs">
      <div
        className={cn(
          "flex items-center gap-3 border-b px-6 py-4 max-md:px-4",
          style.header,
        )}
      >
        <span
          className={cn(
            "flex h-10 w-10 flex-none items-center justify-center rounded-lg",
            style.icon,
          )}
        >
          <AdminIcon name={STATE_ICONS[state]} className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg leading-tight font-semibold text-foreground">
            Sua mesa hoje
          </h2>
          <p
            className={cn(
              "mt-1.5 inline-flex max-w-full items-center gap-2 rounded-full border bg-card px-2.5 py-0.5 text-xs font-semibold",
              style.status,
            )}
          >
            <span
              aria-hidden
              className={cn(
                "h-2 w-2 flex-none rounded-full bg-current",
                style.dot,
              )}
            />
            <span className="min-w-0">
              {status.lead}
              {status.rest && (
                <span className="max-md:hidden">{status.rest}</span>
              )}
            </span>
          </p>
        </div>
        <div className="flex-none text-right">
          <span
            className={cn(
              "block text-4xl leading-none font-semibold tabular-nums max-md:text-3xl",
              style.number,
            )}
          >
            {totalCount}
          </span>
          <span className="mt-1 block text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {totalCount === 1 ? "pendência" : "pendências"}
          </span>
        </div>
      </div>
      {items.length === 0 ? (
        // An empty desk is the good outcome, not missing data: it says the
        // office owes nobody an answer right now, and never that there is
        // nothing open, since answered records stay open in the queue. So it
        // points at what comes next instead.
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-6 py-3.5 text-sm text-muted-foreground max-md:px-4">
          {awaitingCitizen > 0 && (
            <span>
              <span className="font-medium text-foreground tabular-nums">
                {awaitingCitizen}
              </span>{" "}
              {awaitingCitizen === 1
                ? "pedido aguarda o cidadão"
                : "pedidos aguardam o cidadão"}
            </span>
          )}
          {nextAppointmentTime && (
            <span>
              Próximo atendimento{" "}
              <span className="font-medium text-foreground tabular-nums">
                {nextAppointmentTime}
              </span>
            </span>
          )}
          <Link
            href="/admin/pedidos"
            className="font-medium text-primary underline-offset-4 hover:underline md:ml-auto"
          >
            Ver a fila de pedidos →
          </Link>
        </div>
      ) : (
        <ul className="divide-y">
          {items.map((item) => (
            <li key={`${item.kind}-${item.protocolNumber}`}>
              <Link
                href={item.actionHref}
                className={cn(
                  "flex flex-wrap items-center gap-x-3.5 gap-y-2 border-l-4 px-5 py-3 transition-colors hover:bg-muted/50 motion-safe:animate-row-glow",
                  EDGE_STYLES[item.chipTone],
                )}
              >
                <Badge
                  className={cn(
                    "min-w-28 flex-none",
                    CHIP_STYLES[item.chipTone],
                  )}
                >
                  {item.chipLabel}
                </Badge>
                <span className="min-w-0 flex-1 max-md:basis-[calc(100%-100px)]">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {item.protocolNumber} · {item.displayName}
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                    {item.summary}
                  </span>
                </span>
                <span
                  className={cn(
                    buttonVariants({
                      variant: ACTION_VARIANTS[item.chipTone],
                      size: "sm",
                    }),
                    "flex-none max-md:w-full",
                  )}
                >
                  {item.actionLabel}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {hidden > 0 && (
        <div className="border-t px-6 py-3">
          <Link
            href="/admin/pedidos"
            className={cn(buttonVariants({ variant: "link" }), "h-auto px-0")}
          >
            + {hidden} {hidden === 1 ? "item aguardando" : "itens aguardando"}
          </Link>
        </div>
      )}
    </section>
  );
}
