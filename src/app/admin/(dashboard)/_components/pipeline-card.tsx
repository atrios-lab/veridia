import Link from "next/link";
import { cn } from "../../_ui/cn.ts";
import { CLOSED_TAB, QUEUE_TABS } from "../pedidos/_components/queue-order.ts";
import type { Tone } from "../pedidos/_components/status-tone.ts";

/**
 * A stage with requests in it, coloured by what it means: stopped on an
 * exigência, waiting on the citizen, being worked on, ready to hand over.
 * The same tones the queue's tabs use.
 */
/** The bar on top of a stage with requests, in the tone's full colour. */
const STRIPES: Record<Tone, string> = {
  blocked: "bg-destructive",
  waiting: "bg-warning",
  working: "bg-success",
  delivered: "bg-primary-foreground/60",
  closed: "bg-muted-foreground/40",
};

const ACTIVE_STYLES: Record<Tone, string> = {
  blocked: "border-destructive/40 bg-destructive-soft text-destructive",
  waiting: "border-warning/30 bg-warning-soft text-warning-text",
  working: "border-success/30 bg-success-soft text-success-text",
  delivered: "border-primary bg-primary text-primary-foreground",
  closed: "border-border bg-muted text-muted-foreground",
};

/**
 * The open service requests, stage by stage, in the order the work goes
 * (decision of 12/11/2026): one block per stage with its number large and
 * its name under it, an arrow to the next, and the colour of what the
 * stage means. A stage with nothing in it stays quiet. Each block opens its
 * tab of the queue; the counting is the queue's own.
 */
export function PipelineCard({ counts }: { counts: Record<string, number> }) {
  // The pedidos still waiting on the signed requerimento have not reached
  // the office: they have their own tab in the queue, not a stage here.
  const stages = QUEUE_TABS.filter(
    (tab) => tab.id !== CLOSED_TAB && tab.id !== "awaiting-signed-form",
  ).map((tab) => ({
    ...tab,
    count: tab.statuses.reduce((sum, s) => sum + (counts[s] ?? 0), 0),
  }));
  const total = stages.reduce((sum, s) => sum + s.count, 0);
  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-xs">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b bg-gradient-to-r from-primary-soft to-card to-70% px-6 pt-5 pb-4">
        <div>
          <h2 className="text-lg font-semibold text-primary">
            Pedidos em aberto por etapa
          </h2>
          <p className="text-sm text-muted-foreground">
            Do recebimento à retirada. Clique numa etapa para abrir a fila.
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          <strong className="text-2xl font-semibold text-primary tabular-nums">
            {total}
          </strong>{" "}
          {total === 1 ? "pedido em aberto" : "pedidos em aberto"}
        </p>
      </div>
      <ol className="grid grid-cols-2 gap-2.5 px-6 pt-4 pb-6 sm:grid-cols-4 xl:grid-cols-7">
        {stages.map((s, i) => {
          const active = s.count > 0;
          return (
            <li key={s.id} className="relative">
              <Link
                href={`/admin/pedidos?aba=${s.id}`}
                className={cn(
                  "relative flex h-full flex-col gap-1 overflow-hidden rounded-lg border px-3.5 pt-4 pb-3 transition hover:-translate-y-0.5 hover:shadow-sm",
                  active
                    ? `${ACTIVE_STYLES[s.tone]} motion-safe:animate-attention-pulse-light`
                    : "border-border bg-gradient-to-b from-muted to-card text-muted-foreground",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute inset-x-0 top-0 h-1",
                    active ? STRIPES[s.tone] : "bg-muted-foreground/30",
                  )}
                />
                <span
                  className={cn(
                    "w-fit rounded-full border px-2 py-0.5 text-xs font-medium",
                    active && s.tone === "delivered"
                      ? "border-primary-foreground/30 bg-primary-foreground/15"
                      : "border-current/20 bg-card/70",
                  )}
                >
                  Etapa {i + 1}
                </span>
                <span
                  className={cn(
                    "text-3xl leading-none font-semibold tabular-nums",
                    active && "motion-safe:animate-number-blink",
                  )}
                >
                  {s.count}
                </span>
                <span
                  className={cn(
                    "text-xs leading-tight font-semibold",
                    !active && "text-muted-foreground",
                  )}
                >
                  {s.label}
                </span>
                {active && <span className="text-xs opacity-85">{s.hint}</span>}
              </Link>
              {i < stages.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute top-1/2 -right-[11px] z-10 hidden h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full border bg-card text-xs text-muted-foreground xl:flex"
                >
                  ›
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
