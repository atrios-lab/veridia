import Link from "next/link";
import { CLOSED_TAB, QUEUE_TABS } from "../pedidos/_components/queue-order.ts";
import type { Tone } from "../pedidos/_components/status-tone.ts";

/**
 * A stage with requests in it, coloured by what it means: stopped on an
 * exigência, waiting on the citizen, being worked on, ready to hand over.
 * The same tones the queue's tabs use.
 */
const ACTIVE_STYLES: Record<Tone, string> = {
  blocked: "border-admin-error-border bg-admin-error-bg text-admin-error-text",
  waiting:
    "border-admin-warning-soft-border bg-admin-warning-bg text-admin-warning-text",
  working:
    "border-admin-success-bg bg-admin-success-bg text-admin-success-text",
  delivered: "border-admin-primary bg-admin-primary text-white",
  closed: "border-admin-border bg-admin-readonly-bg text-admin-muted",
};

/**
 * The open service requests, stage by stage, in the order the work goes
 * (decision of 12/11/2026): one block per stage with its number large and
 * its name under it, an arrow to the next, and the colour of what the
 * stage means. A stage with nothing in it stays quiet. Each block opens its
 * tab of the queue; the counting is the queue's own.
 */
export function PipelineCard({ counts }: { counts: Record<string, number> }) {
  const stages = QUEUE_TABS.filter((tab) => tab.id !== CLOSED_TAB).map(
    (tab) => ({
      ...tab,
      count: tab.statuses.reduce((sum, s) => sum + (counts[s] ?? 0), 0),
    }),
  );
  const total = stages.reduce((sum, s) => sum + s.count, 0);
  return (
    <section className="rounded-[16px] border border-admin-border bg-admin-card p-5.5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-serif text-[18px] font-semibold text-admin-primary">
            Pedidos em aberto por etapa
          </h2>
          <p className="text-[12.5px] text-admin-muted">
            Do recebimento à retirada. Clique numa etapa para abrir a fila.
          </p>
        </div>
        <p className="text-[13px] text-admin-muted">
          <strong className="font-serif text-[26px] font-semibold text-admin-primary tabular-nums">
            {total}
          </strong>{" "}
          {total === 1 ? "pedido em aberto" : "pedidos em aberto"}
        </p>
      </div>
      <ol className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
        {stages.map((s, i) => {
          const active = s.count > 0;
          return (
            <li key={s.id} className="relative">
              <Link
                href={`/admin/pedidos?aba=${s.id}`}
                className={`flex h-full flex-col gap-1 rounded-[12px] border px-3.5 py-3 transition hover:-translate-y-0.5 hover:shadow-sm ${
                  active
                    ? ACTIVE_STYLES[s.tone]
                    : "border-admin-border bg-admin-card text-admin-faint"
                }`}
              >
                <span className="text-[10.5px] font-bold uppercase tracking-[0.1em] opacity-80">
                  Etapa {i + 1}
                </span>
                <span className="font-serif text-[32px] leading-none font-semibold tabular-nums">
                  {s.count}
                </span>
                <span
                  className={`text-[12.5px] leading-tight font-semibold ${active ? "" : "text-admin-muted"}`}
                >
                  {s.label}
                </span>
                {active && (
                  <span className="text-[11.5px] opacity-85">{s.hint}</span>
                )}
              </Link>
              {i < stages.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute top-1/2 -right-[11px] z-10 hidden h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full border border-admin-border bg-admin-card text-[12px] text-admin-muted xl:flex"
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
