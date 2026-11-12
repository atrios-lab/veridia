import Link from "next/link";
import { AdminIcon, type AdminIconName } from "../../_components/icon.tsx";
import { cn } from "../../_ui/cn.ts";

export interface OverviewKpi {
  key: string;
  label: string;
  value: number;
  caption: string;
  href: string;
  icon: AdminIconName;
  /** Red when the number is a problem (a prazo crítico). */
  alert?: boolean;
}

/**
 * The Visão geral's opening (decision of 12/11/2026): the greeting, the
 * date and the day's numbers, large, so the first thing seen is how much is
 * waiting and what is urgent. Each number opens the screen it counts. On the
 * neutral panel (11/11/2026) the numbers are cards; what has something
 * pending keeps its halo and its blinking number.
 */
export function OverviewHeader({
  greeting,
  dateLabel,
  kpis,
}: {
  greeting: string;
  dateLabel: string;
  kpis: OverviewKpi[];
}) {
  return (
    <div className="px-4 pt-6 md:px-8 md:pt-8">
      <section className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Painel do cartório · {dateLabel}
            </p>
            <h1 className="mt-1 text-2xl leading-tight font-semibold text-foreground">
              {greeting}
            </h1>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-success" />
            Atualizado agora
          </span>
        </div>
        <div
          className="grid gap-3"
          style={{
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          }}
        >
          {kpis.map((kpi) => (
            <Link
              key={kpi.key}
              href={kpi.href}
              className={cn(
                "group flex flex-col gap-1.5 rounded-xl border px-4 py-3.5 shadow-xs transition-colors max-md:px-3 max-md:py-3",
                kpi.alert
                  ? "border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90 motion-safe:animate-attention-pulse"
                  : kpi.value > 0
                    ? "border-primary bg-card text-foreground ring-1 ring-primary hover:bg-muted/50 motion-safe:animate-attention-pulse"
                    : "bg-card text-foreground hover:bg-muted/50",
              )}
            >
              <span
                className={cn(
                  "flex items-center gap-2 text-sm font-medium",
                  kpi.alert
                    ? "text-destructive-foreground"
                    : "text-muted-foreground",
                )}
              >
                <AdminIcon name={kpi.icon} className="h-4 w-4" />
                {kpi.label}
              </span>
              <span
                className={cn(
                  "flex items-center gap-2 text-3xl leading-none font-semibold tabular-nums",
                  kpi.value > 0 && "motion-safe:animate-number-blink",
                )}
              >
                {kpi.value}
                {kpi.value > 0 && (
                  <span className="relative flex h-2.5 w-2.5">
                    <span
                      className={cn(
                        "absolute inline-flex h-full w-full rounded-full opacity-75 motion-safe:animate-ping",
                        kpi.alert ? "bg-destructive-foreground" : "bg-primary",
                      )}
                    />
                    <span
                      className={cn(
                        "relative inline-flex h-2.5 w-2.5 rounded-full",
                        kpi.alert ? "bg-destructive-foreground" : "bg-primary",
                      )}
                    />
                  </span>
                )}
              </span>
              <span
                className={cn(
                  "text-xs",
                  kpi.alert
                    ? "text-destructive-foreground"
                    : "text-muted-foreground group-hover:text-foreground",
                )}
              >
                {kpi.caption} →
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
