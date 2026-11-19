import Link from "next/link";
import { Badge } from "../../../_ui/badge.tsx";
import { cn } from "../../../_ui/cn.ts";
import {
  CLOSED_TAB,
  QUEUE_TABS,
  type QueueQuery,
  type QueueTabId,
  queueHref,
} from "./queue-order.ts";
import { type Tone, toneSolidClass } from "./status-tone.ts";

/** A stage with requests: its tone on a soft fill, with a bar on top. */
const FULL_STYLES: Record<
  Tone,
  { card: string; stripe: string; title: string }
> = {
  blocked: {
    card: "border-destructive/40 bg-gradient-to-b from-destructive-soft to-card",
    stripe: "bg-destructive",
    title: "text-destructive",
  },
  waiting: {
    card: "border-warning/40 bg-gradient-to-b from-warning-soft to-card",
    stripe: "bg-warning",
    title: "text-warning-text",
  },
  working: {
    card: "border-success/40 bg-gradient-to-b from-success-soft to-card",
    stripe: "bg-success",
    title: "text-success-text",
  },
  delivered: {
    card: "border-primary/40 bg-gradient-to-b from-primary-soft to-card",
    stripe: "bg-primary",
    title: "text-primary",
  },
  closed: {
    card: "bg-gradient-to-b from-muted to-card",
    stripe: "bg-muted-foreground/40",
    title: "text-foreground",
  },
};

/**
 * The queue's stages as bordered cards: one per andamento, in the order the
 * work goes, each with its name, its count and what it waits on; Finalizados
 * closes the row on the right. A stage with requests in it shows its count
 * in the solid colour of what it means; the stage being read takes the
 * primary border, a tinted background and a bar on top (decision of
 * 13/11/2026: a bare underline, loose under a wrapped grid, read as
 * nothing selected). Links, not buttons: the stage is the `aba` parameter
 * of the URL, so the address bar, the back button and a bookmark all agree
 * on which one is open.
 */
export function QueueTabs({
  query,
  counts,
}: {
  query: QueueQuery;
  counts: Record<QueueTabId, number>;
}) {
  let step = 0;
  return (
    <nav aria-label="Etapas dos pedidos" className="border-b">
      <p className="border-b bg-gradient-to-r from-primary-soft to-card to-70% px-4 py-2.5 text-xs text-muted-foreground">
        Escolha uma etapa para ver os pedidos que estão nela.
      </p>
      {/* One row on a wide screen: the stages and Finalizados side by side,
          the count on the "Etapa N" line so the stage's name gets the
          card's whole width. Narrower, they wrap into a grid of cards. */}
      <div className="grid grid-cols-2 gap-2 px-4 pt-3 pb-4 sm:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-9">
        {QUEUE_TABS.map((tab) => {
          const active = tab.id === query.tab;
          const count = counts[tab.id] ?? 0;
          const closed = tab.id === CLOSED_TAB;
          if (!closed) step += 1;
          const full = count > 0 && !closed ? FULL_STYLES[tab.tone] : null;
          return (
            <Link
              key={tab.id}
              href={queueHref(query, { tab: tab.id })}
              scroll={false}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex min-w-0 flex-col gap-1 overflow-hidden rounded-lg border px-3 pt-2.5 pb-3 transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                active
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : full
                    ? `${full.card} text-foreground hover:brightness-[0.98]`
                    : "bg-gradient-to-b from-muted to-card text-muted-foreground hover:border-primary/50 hover:text-foreground",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "absolute inset-x-0 top-0 h-1",
                  active
                    ? "bg-primary-foreground/50"
                    : full
                      ? full.stripe
                      : "bg-muted-foreground/30",
                )}
              />
              <span
                className={cn(
                  "flex items-center justify-between gap-2 text-xs font-medium whitespace-nowrap",
                  active
                    ? "text-primary-foreground/80"
                    : full
                      ? full.title
                      : "text-muted-foreground",
                )}
              >
                {closed ? "Encerrados" : `Etapa ${step}`}
                <Badge
                  className={cn(
                    "tabular-nums",
                    count > 0
                      ? toneSolidClass(tab.tone)
                      : active
                        ? "bg-primary-foreground/15 text-primary-foreground"
                        : "bg-card text-muted-foreground",
                    count > 0 &&
                      !closed &&
                      "motion-safe:animate-attention-pulse-light",
                  )}
                >
                  {count}
                </Badge>
              </span>
              <span className="text-sm leading-tight font-medium">
                {tab.label}
                {active && <span className="sr-only"> (aberta)</span>}
              </span>
              <span
                className={cn(
                  "text-xs leading-snug",
                  active
                    ? "text-primary-foreground/80"
                    : "text-muted-foreground",
                )}
              >
                {tab.hint}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
