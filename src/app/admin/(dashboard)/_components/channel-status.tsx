import Link from "next/link";
import { ROUTE_BY_KIND } from "@/core/overview/desk.ts";
import type { RequestKind } from "@/core/request/kinds.ts";
import { cn } from "../../_ui/cn.ts";

export interface ChannelStatusRow {
  kind: RequestKind;
  label: string;
  count: number;
  critical: boolean;
}

export function ChannelStatus({ rows }: { rows: ChannelStatusRow[] }) {
  if (rows.length === 0) return null;
  return (
    <section className="rounded-xl border bg-card shadow-xs">
      <h2 className="px-6 pt-6 pb-2 text-base font-semibold text-foreground">
        Situação dos canais
      </h2>
      <div className="flex flex-col divide-y px-3 pb-3">
        {rows.map((row) => (
          <Link
            key={row.kind}
            href={ROUTE_BY_KIND[row.kind]}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted/50",
              row.critical
                ? "font-semibold text-destructive"
                : "text-foreground",
            )}
          >
            <span className="w-6 flex-none text-lg font-semibold tabular-nums">
              {row.count}
            </span>
            <span className="flex-1">{row.label}</span>
            <span aria-hidden="true" className="text-muted-foreground">
              →
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
