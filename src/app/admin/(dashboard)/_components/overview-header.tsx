import Link from "next/link";
import { AdminIcon, type AdminIconName } from "../../_components/icon.tsx";

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
 * date and the day's numbers, large, on the office's own colour, so the
 * first thing seen is how much is waiting and what is urgent. Each number
 * opens the screen it counts.
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
    <div className="px-[30px] pt-[26px] max-md:px-4">
      <section className="relative overflow-hidden rounded-[20px] bg-admin-primary px-7 py-6 text-white shadow-[0_18px_40px_-20px_rgba(0,0,0,0.55)] max-md:px-5">
        {/* A fine grid and a glow of the office's accent: depth without
            noise. Decorative only. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
            maskImage:
              "linear-gradient(110deg, transparent 0%, black 55%, black 100%)",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-20 h-72 w-72 rounded-full bg-admin-accent opacity-25 blur-3xl"
        />
        <div className="relative flex flex-col gap-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11.5px] font-bold uppercase tracking-[0.18em] text-white/70">
                Painel do cartório · {dateLabel}
              </p>
              <h1 className="mt-1 font-serif text-[30px] leading-[1.1] font-semibold">
                {greeting}
              </h1>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[12px] font-semibold text-white/85 ring-1 ring-white/15">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
              </span>
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
                className={`group flex flex-col gap-1.5 rounded-[14px] px-4 py-3.5 ring-1 max-md:px-3 max-md:py-3 backdrop-blur-sm transition hover:-translate-y-0.5 ${
                  kpi.alert
                    ? "bg-admin-error-text/90 ring-white/25 hover:bg-admin-error-text motion-safe:animate-attention-pulse"
                    : kpi.value > 0
                      ? "bg-admin-on-dark-accent/20 ring-2 ring-admin-on-dark-accent hover:bg-admin-on-dark-accent/30 motion-safe:animate-attention-pulse"
                      : "bg-white/10 ring-white/15 hover:bg-white/15"
                }`}
              >
                <span className="flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-[0.08em] text-white/80">
                  <AdminIcon name={kpi.icon} className="h-4 w-4" />
                  {kpi.label}
                </span>
                <span
                  className={`flex items-center gap-2 font-serif text-[36px] leading-none font-semibold tabular-nums max-md:text-[30px] ${
                    kpi.value > 0 ? "motion-safe:animate-number-blink" : ""
                  }`}
                >
                  {kpi.value}
                  {kpi.value > 0 && (
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-admin-on-dark-accent opacity-75 motion-safe:animate-ping" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-admin-on-dark-accent" />
                    </span>
                  )}
                </span>
                <span className="text-[12px] text-white/75 group-hover:text-white">
                  {kpi.caption} →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
