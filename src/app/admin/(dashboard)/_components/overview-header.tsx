import Link from "next/link";
import { AdminIcon, type AdminIconName } from "../../_components/icon.tsx";
import { cn } from "../../_ui/cn.ts";

/** The colour that tells a card apart, the same whether it holds 0 or 12. */
export type KpiTone = "primary" | "destructive" | "info" | "success" | "teal";

export interface OverviewKpi {
  key: string;
  label: string;
  value: number;
  caption: string;
  href: string;
  icon: AdminIconName;
  tone: KpiTone;
  /** Said, with a check, when the number is 0: "nenhum prazo vencendo". */
  okCaption?: string;
  /** Red when the number is a problem (a prazo crítico). */
  alert?: boolean;
}

// Written out whole, one line per tone, so Tailwind finds every class.
const TONES: Record<
  KpiTone,
  { stripe: string; icon: string; number: string; glow: string; dot: string }
> = {
  primary: {
    stripe: "border-l-primary",
    icon: "bg-primary-soft text-primary",
    number: "text-primary",
    glow: "to-primary-soft",
    dot: "bg-primary",
  },
  destructive: {
    stripe: "border-l-destructive",
    icon: "bg-destructive-soft text-destructive",
    number: "text-destructive",
    glow: "to-destructive-soft",
    dot: "bg-destructive",
  },
  info: {
    stripe: "border-l-info",
    icon: "bg-info-soft text-info",
    number: "text-info",
    glow: "to-info-soft",
    dot: "bg-info",
  },
  success: {
    stripe: "border-l-success",
    icon: "bg-success-soft text-success-text",
    number: "text-success-text",
    glow: "to-success-soft",
    dot: "bg-success",
  },
  teal: {
    stripe: "border-l-teal",
    icon: "bg-teal-soft text-teal",
    number: "text-teal",
    glow: "to-teal-soft",
    dot: "bg-teal",
  },
};

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
          {kpis.map((kpi) => {
            const tone = TONES[kpi.tone];
            const has = kpi.value > 0;
            return (
              <Link
                key={kpi.key}
                href={kpi.href}
                className={cn(
                  "group flex flex-col gap-1.5 rounded-xl border border-l-4 px-4 py-3.5 shadow-xs transition-colors max-md:px-3 max-md:py-3",
                  kpi.alert
                    ? "border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90 motion-safe:animate-attention-pulse"
                    : cn(
                        "text-foreground",
                        tone.stripe,
                        has
                          ? `bg-gradient-to-br from-card from-55% ${tone.glow} hover:brightness-[0.98]`
                          : "bg-card hover:bg-muted/50",
                      ),
                )}
              >
                <span
                  className={cn(
                    "flex items-center gap-2 text-sm font-medium",
                    kpi.alert
                      ? "text-destructive-foreground"
                      : "text-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-7 flex-none items-center justify-center rounded-md",
                      kpi.alert
                        ? "bg-destructive-foreground/15 text-destructive-foreground"
                        : tone.icon,
                    )}
                  >
                    <AdminIcon name={kpi.icon} className="h-4 w-4" />
                  </span>
                  {kpi.label}
                </span>
                <span
                  className={cn(
                    "flex items-center gap-2 text-3xl leading-none font-semibold tabular-nums",
                    !kpi.alert && (has ? tone.number : "text-muted-foreground"),
                    has && "motion-safe:animate-number-blink",
                  )}
                >
                  {kpi.value}
                  {has && (
                    <span className="relative flex h-2.5 w-2.5">
                      <span
                        className={cn(
                          "absolute inline-flex h-full w-full rounded-full opacity-75 motion-safe:animate-ping",
                          kpi.alert ? "bg-destructive-foreground" : tone.dot,
                        )}
                      />
                      <span
                        className={cn(
                          "relative inline-flex h-2.5 w-2.5 rounded-full",
                          kpi.alert ? "bg-destructive-foreground" : tone.dot,
                        )}
                      />
                    </span>
                  )}
                </span>
                {!has && kpi.okCaption ? (
                  <span className="flex items-center gap-1 text-xs font-medium text-success-text">
                    <AdminIcon name="check" className="h-3.5 w-3.5" />
                    {kpi.okCaption}
                  </span>
                ) : (
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
                )}
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
