import {
  type BulletinFigures,
  type BulletinStatus,
  bulletinBalanceCents,
  bulletinPeriod,
  formatMoneyBRL,
  formatMonthYear,
} from "@/core/transparency/bulletin.ts";

/**
 * The bulletin exactly as it prints: the panel shows this beside the form so
 * "como sai no site" is not a promise, it is the same markup. The PDF route
 * draws the same fields from the same core, so preview and file never drift in
 * content, only in medium.
 */
export function BulletinPreview({
  officeName,
  officeSubtitle,
  cns,
  legalFooter,
  month,
  year,
  figures,
  status,
}: {
  officeName: string;
  officeSubtitle: string;
  cns: string;
  legalFooter: string;
  month: number;
  year: number;
  figures: BulletinFigures;
  status: BulletinStatus;
}) {
  const balance = bulletinBalanceCents(figures);

  return (
    <div className="overflow-hidden rounded-[14px] border border-admin-border bg-admin-card">
      <div className="bg-admin-primary px-6 py-4 text-white">
        <p className="font-serif text-[15px] font-semibold">{officeName}</p>
        <p className="text-[11.5px] text-admin-on-dark-subtitle">
          {officeSubtitle} · CNS {cns}
        </p>
      </div>

      <div className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 className="font-serif text-[18px] font-semibold text-admin-primary">
              Boletim Mensal, {formatMonthYear(month, year)}
            </h4>
            <p className="mt-0.5 text-[12px] text-admin-muted">
              Período: {bulletinPeriod(month, year)}
            </p>
          </div>
          {status === "preliminary" && (
            <span className="rounded-full bg-admin-warning-bg px-3 py-1 text-[11px] font-bold text-admin-warning-text">
              Dados preliminares
            </span>
          )}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-[11px] border border-admin-border p-4">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-admin-accent">
              De onde veio
            </p>
            <dl className="mt-2 space-y-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-[12.5px] text-admin-text">
                  Atos praticados
                </dt>
                <dd className="text-[14px] font-bold text-admin-primary tabular-nums">
                  {figures.actsCount.toLocaleString("pt-BR")}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-[12.5px] text-admin-text">Arrecadação</dt>
                <dd className="text-[14px] font-bold text-admin-primary tabular-nums">
                  R$ {formatMoneyBRL(figures.grossRevenueCents)}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-[11px] border border-admin-border p-4">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-admin-accent">
              Para onde foi
            </p>
            <dl className="mt-2 space-y-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-[12.5px] text-admin-text">
                  Tributos pagos
                  <span className="block text-[10.5px] text-admin-faint">
                    FCRCPN, FRMP, FDJ, FUNAF, ISS
                  </span>
                </dt>
                <dd className="text-[14px] font-bold text-admin-primary tabular-nums">
                  R$ {formatMoneyBRL(figures.taxesPaidCents)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 border-t border-admin-border pt-1.5">
                <dt className="text-[12.5px] text-admin-text">Despesas</dt>
                <dd className="text-[14px] font-bold text-admin-primary tabular-nums">
                  R$ {formatMoneyBRL(figures.expensesCents)}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 rounded-[11px] bg-admin-primary px-5 py-4 text-white">
          <span className="text-[14px] font-semibold">Saldo final do mês</span>
          <span className="font-serif text-[22px] font-bold tabular-nums">
            R$ {formatMoneyBRL(balance)}
          </span>
        </div>

        <p className="mt-4 border-t border-admin-border pt-3 text-[10.5px] leading-relaxed text-admin-faint">
          {legalFooter}
        </p>
      </div>
    </div>
  );
}
