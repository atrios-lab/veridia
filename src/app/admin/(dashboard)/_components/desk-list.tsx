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

export function DeskList({
  items,
  totalCount,
}: {
  items: RankedDeskItem[];
  /** Every item awaiting the office, not just the ones the desk has room
   * for: what the ranking cut has to stay countable, or an operator reads a
   * full desk as the whole workload. Items waiting on the citizen are not
   * counted here, so the notice never points at work the desk would not
   * show either. */
  totalCount: number;
}) {
  const hidden = totalCount - items.length;
  // In plain sight (decision of 12/11/2026): the desk is the reason the
  // screen exists. Each row is one link, the whole width, to its next step.
  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-xs">
      <div className="flex flex-wrap items-center gap-3 border-b px-6 py-4">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <AdminIcon name="inbox" className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg leading-tight font-semibold text-foreground">
            Sua mesa hoje
          </h2>
          <p className="text-sm text-muted-foreground">
            O que aguarda o cartório, do mais urgente ao menos urgente
          </p>
        </div>
        <span
          className={cn(
            "rounded-full bg-primary px-3.5 py-1 text-lg font-semibold text-primary-foreground tabular-nums",
            totalCount > 0 && "motion-safe:animate-attention-pulse",
          )}
        >
          <span
            className={
              totalCount > 0 ? "motion-safe:animate-number-blink" : undefined
            }
          >
            {totalCount}
          </span>
        </span>
      </div>
      {items.length === 0 ? (
        // An empty desk is the good outcome, not missing data: it says the
        // office owes nobody an answer right now, and never that there is
        // nothing open, since answered records stay open in the queue.
        <p className="px-6 py-4 text-sm text-muted-foreground">
          Nada aguarda o cartório agora.{" "}
          <Link
            href="/admin/pedidos"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Ver a fila de pedidos
          </Link>
        </p>
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
