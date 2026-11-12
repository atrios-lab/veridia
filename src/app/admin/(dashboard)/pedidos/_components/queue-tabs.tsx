import Link from "next/link";
import {
  CLOSED_TAB,
  QUEUE_TABS,
  type QueueQuery,
  type QueueTabId,
  queueHref,
} from "./queue-order.ts";
import type { Tone } from "./status-tone.ts";

/** A stage with requests in it, in the colour of what it means. */
const FILLED: Record<Tone, string> = {
  blocked: "border-admin-error-border bg-admin-error-bg text-admin-error-text",
  waiting:
    "border-admin-warning-soft-border bg-admin-warning-bg text-admin-warning-text",
  working:
    "border-admin-success-bg bg-admin-success-bg text-admin-success-text",
  delivered: "border-admin-primary-soft bg-admin-input-bg text-admin-primary",
  closed: "border-admin-border bg-admin-readonly-bg text-admin-muted",
};

/**
 * The queue's stages as blocks (decision of 12/11/2026): one per andamento,
 * in the order the work goes, each with its count large, its name and what
 * it waits on, in the colour of what it means; the stage being read is
 * filled in the office's colour and marked. Links, not buttons: the stage
 * is the `aba` parameter of the URL, so the address bar, the back button
 * and a bookmark all agree on which one is open.
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
    <nav
      aria-label="Etapas dos pedidos"
      className="border-b border-admin-border px-4 pt-4 pb-4"
    >
      <p className="mb-2.5 text-[12.5px] text-admin-muted">
        Escolha uma etapa para ver os pedidos que estão nela.
      </p>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-8">
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
              className={`flex flex-col gap-1 rounded-[12px] border-2 px-3.5 py-3 transition hover:-translate-y-0.5 hover:shadow-sm ${
                active
                  ? "border-admin-primary bg-admin-primary text-white shadow-[0_10px_24px_-14px_rgba(0,0,0,0.6)]"
                  : count > 0 && !closed
                    ? `${FILLED[tab.tone]} motion-safe:animate-attention-pulse-light`
                    : count > 0
                      ? FILLED[tab.tone]
                      : "border-admin-border bg-admin-card text-admin-faint"
              }`}
            >
              <span className="flex items-center justify-between gap-2 text-[10.5px] font-bold uppercase tracking-[0.1em] opacity-85">
                {closed ? "Encerrados" : `Etapa ${step}`}
                {active && (
                  <span className="rounded-full bg-white/20 px-2 py-0.5 tracking-normal normal-case">
                    aberta
                  </span>
                )}
              </span>
              <span className="font-serif text-[28px] leading-none font-semibold tabular-nums">
                {count}
              </span>
              <span
                className={`text-[13px] leading-tight font-semibold ${
                  active || count > 0 ? "" : "text-admin-muted"
                }`}
              >
                {tab.label}
              </span>
              <span className="text-[11.5px] leading-snug opacity-85">
                {tab.hint}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
