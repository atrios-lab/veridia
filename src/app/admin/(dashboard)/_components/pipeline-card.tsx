import Link from "next/link";
import { CLOSED_TAB, QUEUE_TABS } from "../pedidos/_components/queue-order.ts";

/** One colour per open tab of the queue, from the office's own tokens. */
const SEGMENT_COLOURS: Record<string, string> = {
  new: "bg-admin-primary-soft",
  "awaiting-compliance": "bg-admin-error-text",
  "awaiting-payment": "bg-admin-accent",
  "payment-reported": "bg-admin-warning-text",
  processing: "bg-admin-primary",
  "ready-for-pickup": "bg-admin-success-text",
};

/**
 * The open service requests by stage (decision of 12/11/2026): one bar
 * split by the queue's tabs, so the whole pipeline reads at a glance, and
 * each stage opens its tab. Same tabs and same counting as the queue.
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
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif text-[17px] font-semibold text-admin-primary">
          Pedidos em aberto por etapa
        </h2>
        <span className="text-[12.5px] text-admin-muted">
          <strong className="font-serif text-[20px] text-admin-primary tabular-nums">
            {total}
          </strong>{" "}
          em aberto
        </span>
      </div>
      <div
        className="mt-3.5 flex h-4 w-full overflow-hidden rounded-full bg-admin-border"
        role="img"
        aria-label={stages.map((s) => `${s.label}: ${s.count}`).join("; ")}
      >
        {total > 0 &&
          stages
            .filter((s) => s.count > 0)
            .map((s) => (
              <div
                key={s.id}
                className={`${SEGMENT_COLOURS[s.id] ?? "bg-admin-primary"} h-full border-r-2 border-admin-card last:border-r-0`}
                style={{ width: `${(s.count / total) * 100}%` }}
              />
            ))}
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {stages.map((s) => (
          <li key={s.id}>
            <Link
              href={`/admin/pedidos?aba=${s.id}`}
              className="flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 hover:bg-admin-input-bg"
            >
              <span
                className={`h-2.5 w-2.5 flex-none rounded-full ${SEGMENT_COLOURS[s.id] ?? "bg-admin-primary"}`}
              />
              <span className="min-w-0 flex-1 text-[12.5px] leading-tight text-admin-text">
                {s.label}
              </span>
              <span className="font-serif text-[17px] font-semibold text-admin-primary tabular-nums">
                {s.count}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
