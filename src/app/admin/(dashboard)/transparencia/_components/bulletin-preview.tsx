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
            ? "text-xs font-semibold text-foreground"
            : "text-xs text-foreground"
        }
      >
        {label}
      </dt>
      <dd
        className={`tabular-nums ${
          strong
            ? "text-sm font-semibold text-foreground"
            : "text-sm text-foreground"
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
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="bg-primary px-6 py-4 text-primary-foreground">
        <p className="text-base font-semibold">{officeName}</p>
        <p className="text-xs text-primary-foreground/80">{officeSubtitle}</p>
      </div>

      <div className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 className="text-lg font-semibold text-foreground">
              Boletim Mensal, {formatMonthYear(month, year)}
            </h4>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Período: {bulletinPeriod(month, year)}
            </p>
          </div>
          {status === "preliminary" && (
            <span className="rounded-full bg-warning px-3 py-1 text-xs font-medium text-warning-foreground">
              Dados preliminares
            </span>
          )}
        </div>

        <dl className="mt-4 space-y-1.5 rounded-lg bg-muted/50 p-4">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-xs font-semibold text-foreground">
              Atos praticados
            </dt>
            <dd className="text-sm font-semibold text-foreground tabular-nums">
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

        <div className="mt-3 rounded-lg bg-muted/50 p-4">
          <p className="text-xs font-medium text-muted-foreground">
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
            <div className="border-t border-border pt-2">
              <Line
                label="Total recolhido aos fundos"
                cents={view.fundsTotalCents}
                strong
              />
            </div>
          </dl>
        </div>

        <dl className="mt-3 space-y-1.5 rounded-lg bg-muted/50 p-4">
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
          <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-primary px-5 py-4 text-primary-foreground">
            <span className="text-sm font-semibold">{BALANCE_LABEL}</span>
            <span className="text-xl font-semibold tabular-nums">
              R$ {formatMoneyBRL(privateFigures.balanceCents)}
            </span>
          </div>
        )}

        <p className="mt-4 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
          {BULLETIN_LEGAL_BASIS} {legalFooter}
        </p>
      </div>
    </div>
  );
}
