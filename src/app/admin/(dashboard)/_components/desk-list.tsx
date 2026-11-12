import Link from "next/link";
import type { DeskChipTone, RankedDeskItem } from "@/core/overview/desk.ts";
import { AdminIcon } from "../../_components/icon.tsx";

const CHIP_STYLES: Record<DeskChipTone, string> = {
  error: "bg-admin-error-bg text-admin-error-text",
  warning: "bg-admin-warning-bg text-admin-warning-text",
  neutral: "bg-admin-readonly-bg text-admin-muted",
};

/** The next-step button reads the same urgency as the chip: filled red for
 * what can't wait, filled green for what's next, an outline for routine
 * work that isn't going anywhere. */
const ACTION_STYLES: Record<DeskChipTone, string> = {
  error: "bg-admin-error-text text-white",
  warning: "bg-admin-primary text-white",
  neutral: "border border-admin-input-border bg-admin-card text-admin-primary",
};

/** The left edge of each item, in the urgency's colour. */
const EDGE_STYLES: Record<DeskChipTone, string> = {
  error: "border-admin-error-text",
  warning: "border-admin-accent",
  neutral: "border-admin-border",
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
  // screen exists, so it gets the strongest frame and its own band.
  return (
    <section className="overflow-hidden rounded-[18px] border-2 border-admin-primary bg-admin-card shadow-[0_14px_34px_-18px_rgba(0,0,0,0.35)]">
      <div className="flex flex-wrap items-center gap-3 bg-admin-primary px-5.5 py-4 text-white">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[12px] bg-white/15 ring-1 ring-white/20">
          <AdminIcon name="inbox" className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-[21px] leading-tight font-semibold">
            Sua mesa hoje
          </h2>
          <p className="text-[12px] text-white/75">
            O que aguarda o cartório, do mais urgente ao menos urgente
          </p>
        </div>
        <span className="rounded-full bg-white px-3.5 py-1 font-serif text-[20px] font-semibold text-admin-primary tabular-nums">
          {totalCount}
        </span>
      </div>
      <div className="px-5.5 pb-4">
        {items.length === 0 ? (
          // An empty desk is the good outcome, not missing data: it says the
          // office owes nobody an answer right now, and never that there is
          // nothing open, since answered records stay open in the queue.
          <p className="mt-4 text-[13.5px] text-admin-muted">
            Nada aguarda o cartório agora.{" "}
            <Link
              href="/admin/pedidos"
              className="font-semibold text-admin-primary"
            >
              Ver a fila de pedidos
            </Link>
          </p>
        ) : (
          <div className="mt-2 flex flex-col">
            {items.map((item) => (
              <div
                key={`${item.kind}-${item.protocolNumber}`}
                className={`-mx-2 flex flex-wrap items-center gap-x-3.5 gap-y-2 rounded-[10px] border-l-4 px-2 py-3 hover:bg-admin-input-bg ${EDGE_STYLES[item.chipTone]}`}
              >
                <span
                  className={`w-[84px] flex-none rounded-full py-1 text-center text-[10.5px] font-bold ${CHIP_STYLES[item.chipTone]}`}
                >
                  {item.chipLabel}
                </span>
                <span className="min-w-0 flex-1 max-md:basis-[calc(100%-100px)]">
                  <span className="block truncate text-[14px] font-semibold text-admin-primary">
                    {item.protocolNumber} · {item.displayName}
                  </span>
                  <span className="mt-0.5 block truncate text-[12px] text-admin-muted">
                    {item.summary}
                  </span>
                </span>
                <Link
                  href={item.actionHref}
                  className={`flex-none rounded-[8px] px-3.5 py-2 text-center text-[12px] font-bold max-md:w-full ${ACTION_STYLES[item.chipTone]}`}
                >
                  {item.actionLabel}
                </Link>
              </div>
            ))}
          </div>
        )}
        {hidden > 0 && (
          <Link
            href="/admin/pedidos"
            className="mt-3 block text-[12.5px] font-semibold text-admin-primary"
          >
            + {hidden} {hidden === 1 ? "item aguardando" : "itens aguardando"}
          </Link>
        )}
      </div>
    </section>
  );
}
