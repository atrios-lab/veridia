import type { IsoDate } from "@/core/scheduling/calendar.ts";
import { formatFullDate } from "@/core/scheduling/calendar.ts";
import { SearchTriggerButton } from "../../_components/global-search.tsx";

export function OverviewHeader({
  greeting,
  deskCount,
  criticalCount,
  today,
}: {
  greeting: string;
  deskCount: number;
  criticalCount: number;
  today: IsoDate;
}) {
  return (
    <header className="flex items-center gap-6 border-b border-admin-border bg-admin-card px-[30px] py-4">
      <div className="flex-none">
        <h1 className="font-serif text-xl font-semibold text-admin-primary">
          {greeting}
        </h1>
        <div className="mt-0.5 text-[12px] text-admin-muted">
          {deskCount} {deskCount === 1 ? "item" : "itens"} na sua mesa
          {criticalCount > 0 &&
            ` · ${criticalCount} prazo${criticalCount === 1 ? "" : "s"} crítico${criticalCount === 1 ? "" : "s"}`}
        </div>
      </div>
      <div className="mx-auto w-full max-w-[540px]">
        <SearchTriggerButton />
      </div>
      <span className="flex-none text-[12.5px] text-admin-muted">
        {formatFullDate(today)}
      </span>
    </header>
  );
}
