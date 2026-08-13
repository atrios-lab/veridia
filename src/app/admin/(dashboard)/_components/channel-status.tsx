import Link from "next/link";
import { ROUTE_BY_KIND } from "@/core/overview/desk.ts";
import type { RequestKind } from "@/core/request/kinds.ts";

export interface ChannelStatusRow {
  kind: RequestKind;
  label: string;
  count: number;
  critical: boolean;
}

export function ChannelStatus({ rows }: { rows: ChannelStatusRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="rounded-[14px] border border-admin-border bg-admin-card p-5">
      <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-admin-muted">
        Situação dos canais
      </span>
      <div className="mt-3 flex flex-col gap-2.5">
        {rows.map((row) => (
          <Link
            key={row.kind}
            href={ROUTE_BY_KIND[row.kind]}
            className={`flex items-center gap-2.5 text-[12.5px] ${
              row.critical
                ? "font-semibold text-admin-error-text"
                : "text-admin-text"
            }`}
          >
            <span className="w-6 flex-none font-serif text-[19px] font-semibold">
              {row.count}
            </span>
            <span className="flex-1">{row.label}</span>
            <span aria-hidden="true" className="text-admin-faint">
              →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
