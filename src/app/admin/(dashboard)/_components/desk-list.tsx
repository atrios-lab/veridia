import Link from "next/link";
import type { DeskChipTone, RankedDeskItem } from "@/core/overview/desk.ts";

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

export function DeskList({
  items,
  totalCount,
}: {
  items: RankedDeskItem[];
  /** Every open item, not just the ones the desk has room for: what the
   * ranking cut has to stay countable, or an operator reads a full desk as
   * the whole workload. */
  totalCount: number;
}) {
  const hidden = totalCount - items.length;
  return (
    <div className="rounded-[14px] border border-admin-border bg-admin-card p-5.5">
      <div className="flex items-baseline gap-2.5">
        <h4 className="flex-1 font-serif text-[16.5px] font-semibold text-admin-primary">
          Sua mesa hoje
        </h4>
        <span className="text-[11.5px] text-admin-faint">
          ordenada por urgência
        </span>
      </div>
      {items.length === 0 ? (
        <p className="mt-3.5 text-[13px] text-admin-muted">
          Nenhum item em aberto agora.
        </p>
      ) : (
        <div className="mt-3 flex flex-col">
          {items.map((item) => (
            <div
              key={`${item.kind}-${item.protocolNumber}`}
              className="flex items-center gap-3.5 border-b border-admin-border py-3 last:border-b-0"
            >
              <span
                className={`w-[84px] flex-none rounded-full py-1 text-center text-[10.5px] font-bold ${CHIP_STYLES[item.chipTone]}`}
              >
                {item.chipLabel}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-admin-primary">
                  {item.protocolNumber} · {item.displayName}
                </span>
                <span className="mt-0.5 block truncate text-[12px] text-admin-muted">
                  {item.summary}
                </span>
              </span>
              <Link
                href={item.actionHref}
                className={`flex-none rounded-[8px] px-3.5 py-2 text-[12px] font-bold ${ACTION_STYLES[item.chipTone]}`}
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
          className="mt-3 block text-[12px] font-semibold text-admin-primary"
        >
          + {hidden} {hidden === 1 ? "item em aberto" : "itens em aberto"}
        </Link>
      )}
    </div>
  );
}
