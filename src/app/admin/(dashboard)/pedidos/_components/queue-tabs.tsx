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
import { toneSolidClass } from "./status-tone.ts";

/**
 * The queue's stages as underlined tabs: one per andamento, in the order the
 * work goes, each with its name, its count and what it waits on; Finalizados
 * closes the row on the right. A stage with requests in it shows its count
 * in the solid colour of what it means; the stage being read is underlined
 * in navy and marked. Links, not buttons: the stage is the `aba` parameter
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
    <nav aria-label="Etapas dos pedidos" className="border-b px-4 pt-4">
      <p className="mb-2 text-xs text-muted-foreground">
        Escolha uma etapa para ver os pedidos que estão nela.
      </p>
      {/* One row from 1280px: the eight stages side by side, the count on
          the "Etapa N" line so the stage's name gets the column's whole
          width. Narrower, they wrap into a grid. */}
      <div className="grid grid-cols-2 gap-x-1 sm:grid-cols-4 xl:grid-cols-8">
        {QUEUE_TABS.map((tab) => {
          const active = tab.id === query.tab;
          const count = counts[tab.id] ?? 0;
          const closed = tab.id === CLOSED_TAB;
          if (!closed) step += 1;
          return (
            <Link
              key={tab.id}
              href={queueHref(query, { tab: tab.id })}
              scroll={false}
              aria-current={active ? "page" : undefined}
              className={cn(
                "-mb-px flex min-w-0 flex-col gap-1 border-b-2 px-2 pt-2 pb-3 transition-colors",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
              )}
            >
              <span className="flex items-center justify-between gap-2 text-xs whitespace-nowrap text-muted-foreground">
                {closed ? "Encerrados" : `Etapa ${step}`}
                <Badge
                  className={cn(
                    "tabular-nums",
                    count > 0
                      ? toneSolidClass(tab.tone)
                      : "bg-muted text-muted-foreground",
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
              <span className="text-xs leading-snug text-muted-foreground">
                {tab.hint}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
