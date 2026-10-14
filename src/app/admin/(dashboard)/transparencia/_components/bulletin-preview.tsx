import {
  BALANCE_LABEL,
  BULLETIN_LEGAL_BASIS,
  type BulletinStatus,
  type BulletinView,
  bulletinPeriod,
  formatMoneyBRL,
  formatMonthYear,
  issLabel,
} from "@/core/transparency/bulletin.ts";

function Line({
  label,
  cents,
  strong = false,
  indent = false,
}: {
  label: string;
  cents: number;
  strong?: boolean;
  indent?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 ${indent ? "pl-4" : ""}`}
    >
      <dt
        className={
          strong
            ? "text-[12.5px] font-semibold text-admin-primary"
            : "text-[12.5px] text-admin-text"
        }
      >
        {label}
      </dt>
      <dd
        className={`tabular-nums ${
          strong
            ? "text-[14px] font-bold text-admin-primary"
            : "text-[13px] text-admin-text"
        }`}
      >
        R$ {formatMoneyBRL(cents)}
      </dd>
    </div>
  );
}

/**
 * The bulletin exactly as it prints: the panel shows this beside the form so
 * "como sai no site" is not a promise, it is the same markup. The PDF route
 * draws the same `BulletinView` from the same core, so preview and file never
 * drift in content, only in medium.
 */
export function BulletinPreview({
  officeName,
  officeSubtitle,
  legalFooter,
  city,
  month,
  year,
  view,
  status,
}: {
  officeName: string;
  officeSubtitle: string;
  legalFooter: string;
  city: string;
  month: number;
  year: number;
  view: BulletinView;
  status: BulletinStatus;
}) {
  const privateFigures = view.privateFigures;

  return (
    <div className="overflow-hidden rounded-[14px] border border-admin-border bg-admin-card">
      <div className="bg-admin-primary px-6 py-4 text-white">
        <p className="font-serif text-[15px] font-semibold">{officeName}</p>
        <p className="text-[11.5px] text-admin-on-dark-subtitle">
          {officeSubtitle}
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

        <dl className="mt-4 space-y-1.5 rounded-[11px] border border-admin-border p-4">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-[12.5px] font-semibold text-admin-primary">
              Atos praticados
            </dt>
            <dd className="text-[14px] font-bold text-admin-primary tabular-nums">
              {view.actsCount.toLocaleString("pt-BR")}
            </dd>
          </div>
          {privateFigures && (
            <Line
              label="Arrecadação"
              cents={privateFigures.grossRevenueCents}
              strong
            />
          )}
        </dl>

        <div className="mt-3 rounded-[11px] border border-admin-border p-4">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-admin-accent">
            Recolhido aos fundos
          </p>
          <dl className="mt-2 space-y-2">
            {view.rubrics.map((group) => (
              <div key={group.rubric} className="space-y-1">
                <Line
                  label={`${group.rubric}. ${group.title}`}
                  cents={group.subtotalCents}
                  strong
                />
                {group.funds.map((fund) => (
                  <Line
                    key={fund.key}
                    label={fund.label}
                    cents={fund.amountCents}
                    indent
                  />
                ))}
              </div>
            ))}
            <div className="border-t border-admin-border pt-2">
              <Line
                label="Total recolhido aos fundos"
                cents={view.fundsTotalCents}
                strong
              />
            </div>
          </dl>
        </div>

        <dl className="mt-3 space-y-1.5 rounded-[11px] border border-admin-border p-4">
          <Line label={issLabel(city)} cents={view.issCents} strong />
          {privateFigures && (
            <Line
              label="Despesas"
              cents={privateFigures.expensesCents}
              strong
            />
          )}
        </dl>

        {privateFigures && (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-[11px] bg-admin-primary px-5 py-4 text-white">
            <span className="text-[14px] font-semibold">{BALANCE_LABEL}</span>
            <span className="font-serif text-[22px] font-bold tabular-nums">
              R$ {formatMoneyBRL(privateFigures.balanceCents)}
            </span>
          </div>
        )}

        <p className="mt-4 border-t border-admin-border pt-3 text-[10.5px] leading-relaxed text-admin-faint">
          {BULLETIN_LEGAL_BASIS} {legalFooter}
        </p>
      </div>
    </div>
  );
}
