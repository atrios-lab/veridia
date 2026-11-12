"use client";

import {
  startTransition,
  useActionState,
  useMemo,
  useState,
  useTransition,
} from "react";
import {
  computeExcess,
  type ExcessPeriod,
} from "@/core/daily-book/excess-calc.ts";
import { ConfirmAction } from "../../../../_components/confirm-action.tsx";
import {
  type ExcessFormState,
  readBookFigures,
  removeExcess,
  saveExcess,
} from "./actions.ts";

const FIELD =
  "w-full rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3.5 py-2.5 text-[13.5px] text-admin-text outline-none focus:border-admin-primary-soft";
const LABEL = "mb-1.5 block text-[12.5px] font-semibold text-admin-text";
const HINT = "mt-1 block text-[11.5px] text-admin-muted";
const IDLE: ExcessFormState = { status: "idle" };

const money = (c: number) =>
  (c / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/** "1.234,56" -> 123456; anything else counts as zero on screen only. */
function cents(text: string): number {
  const t = text.replace(/[R$\s]/g, "");
  if (!t) return 0;
  const n = Number(
    t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t,
  );
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

const lastDay = (y: number, m: number) =>
  `${y}-${String(m).padStart(2, "0")}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;

function periodOf(
  period: ExcessPeriod,
  month: string,
  year: number,
  quarter: number,
): { start: string; end: string } {
  if (period === "mensal") {
    const [y, m] = month.split("-").map(Number);
    return { start: `${month}-01`, end: lastDay(y ?? 2000, m ?? 1) };
  }
  const first = (quarter - 1) * 3 + 1;
  return {
    start: `${year}-${String(first).padStart(2, "0")}-01`,
    end: lastDay(year, first + 2),
  };
}

export interface ExcessInitial {
  id?: string;
  period: ExcessPeriod;
  start: string;
  subsidy: string;
  revenue: string;
  expenses: string;
  notes: string;
}

/** The calculator: the result as the numbers are typed; saved on request. */
export function ExcessForm({ initial }: { initial: ExcessInitial }) {
  const [state, action, pending] = useActionState(saveExcess, IDLE);
  const [period, setPeriod] = useState<ExcessPeriod>(initial.period);
  const [month, setMonth] = useState(initial.start.slice(0, 7));
  const [year, setYear] = useState(Number(initial.start.slice(0, 4)));
  const [quarter, setQuarter] = useState(
    Math.floor((Number(initial.start.slice(5, 7)) - 1) / 3) + 1,
  );
  const [v, setV] = useState({
    subsidy: initial.subsidy,
    revenue: initial.revenue,
    expenses: initial.expenses,
    notes: initial.notes,
  });
  const [reading, startReading] = useTransition();
  const [note, setNote] = useState("");
  const range = periodOf(period, month, year, quarter);
  const result = useMemo(
    () =>
      computeExcess({
        period,
        ...range,
        subsidyCents: cents(v.subsidy),
        revenueCents: cents(v.revenue),
        expensesCents: cents(v.expenses),
      }),
    [period, range, v],
  );
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) =>
    setV((x) => ({ ...x, [k]: e.target.value }));

  const fromBook = () => {
    const data = new FormData();
    data.set("inicio", range.start);
    data.set("fim", range.end);
    startReading(async () => {
      const r = await readBookFigures(data);
      if (!r.ok) {
        setNote(r.message);
        return;
      }
      setV((x) => ({
        ...x,
        revenue: money(r.revenueCents),
        expenses: money(r.expensesCents),
      }));
      setNote(
        "Receitas e despesas do livro no período, sem a remuneração do interino. Confira e ajuste se precisar.",
      );
    });
  };

  const months = result.months === 1 ? "1 mês" : `${result.months} meses`;
  const over = result.excessCents > 0;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
      className="flex flex-col gap-4"
    >
      {state.status === "error" && (
        <p
          role="alert"
          className="rounded-[10px] bg-admin-error-bg px-3.5 py-2.5 text-[13px] font-semibold text-admin-error-text"
        >
          {state.message}
        </p>
      )}
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="inicio" value={range.start} />
      <input type="hidden" name="fim" value={range.end} />

      <Step n={1} title="Período da apuração">
        <fieldset className="flex flex-col gap-2 text-[13px]">
          <legend className="sr-only">Periodicidade</legend>
          {(
            [
              [
                "trimestral",
                "Trimestral",
                "Regra nacional: soma os três meses (art. 194, VI).",
              ],
              [
                "mensal",
                "Mensal",
                "Só quando a norma do Estado mandar apurar mês a mês (no RN, art. 27 do Código de Normas).",
              ],
            ] as const
          ).map(([value, label, hint]) => (
            <label key={value} className="flex items-start gap-2">
              <input
                type="radio"
                name="periodo"
                value={value}
                checked={period === value}
                onChange={() => setPeriod(value)}
                className="mt-1"
              />
              <span>
                <strong>{label}</strong>
                <span className="block text-[12px] text-admin-muted">
                  {hint}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          {period === "mensal" ? (
            <div>
              <label htmlFor="ex-month" className={LABEL}>
                Mês
              </label>
              <input
                id="ex-month"
                type="month"
                required
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className={FIELD}
              />
            </div>
          ) : (
            <>
              <div>
                <label htmlFor="ex-year" className={LABEL}>
                  Ano
                </label>
                <input
                  id="ex-year"
                  type="number"
                  min={2000}
                  max={2100}
                  required
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value) || year)}
                  className={FIELD}
                />
              </div>
              <div>
                <label htmlFor="ex-quarter" className={LABEL}>
                  Trimestre
                </label>
                <select
                  id="ex-quarter"
                  value={quarter}
                  onChange={(e) => setQuarter(Number(e.target.value))}
                  className={FIELD}
                >
                  <option value={1}>1º trimestre (janeiro a março)</option>
                  <option value={2}>2º trimestre (abril a junho)</option>
                  <option value={3}>3º trimestre (julho a setembro)</option>
                  <option value={4}>4º trimestre (outubro a dezembro)</option>
                </select>
              </div>
            </>
          )}
        </div>
      </Step>

      <Step n={2} title="Teto do interino">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="ex-subsidy" className={LABEL}>
              Subsídio mensal de ministro do STF (R$)
            </label>
            <input
              id="ex-subsidy"
              name="subsidio"
              required
              inputMode="decimal"
              placeholder="Ex.: 40.000,00"
              value={v.subsidy}
              onChange={set("subsidy")}
              className={FIELD}
            />
            <span className={HINT}>
              Digite o valor cheio; a calculadora aplica os 90,25%.
            </span>
          </div>
          <dl className="flex flex-col justify-center gap-1 rounded-[10px] bg-admin-input-bg px-4 py-3 text-[13px]">
            <div className="flex justify-between gap-3">
              <dt>Teto do mês (90,25%)</dt>
              <dd className="font-semibold">
                R$ {money(result.ceilingMonthCents)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Teto do período ({months})</dt>
              <dd className="font-semibold">R$ {money(result.limitCents)}</dd>
            </div>
          </dl>
        </div>
      </Step>

      <Step n={3} title="Receitas e despesas do período">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="ex-revenue" className={LABEL}>
              Receitas (R$)
            </label>
            <input
              id="ex-revenue"
              name="receitas"
              required
              inputMode="decimal"
              placeholder="0,00"
              value={v.revenue}
              onChange={set("revenue")}
              className={FIELD}
            />
            <span className={HINT}>Emolumentos do período.</span>
          </div>
          <div>
            <label htmlFor="ex-expenses" className={LABEL}>
              Despesas (R$)
            </label>
            <input
              id="ex-expenses"
              name="despesas"
              required
              inputMode="decimal"
              placeholder="0,00"
              value={v.expenses}
              onChange={set("expenses")}
              className={FIELD}
            />
            <span className={HINT}>
              Despesas da serventia (art. 194, IV), sem a remuneração do próprio
              interino.
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={reading}
            onClick={fromBook}
            className="btn btn-admin-secondary btn-md"
          >
            {reading
              ? "Lendo o livro..."
              : "Preencher com os lançamentos do livro"}
          </button>
          {note && (
            <output className="text-[12.5px] font-semibold text-admin-primary">
              {note}
            </output>
          )}
        </div>
      </Step>

      <Step n={4} title="Resultado">
        <ol className="flex flex-col gap-1.5 text-[13.5px] text-admin-text">
          <li>
            <strong>Renda líquida</strong> = receitas (R${" "}
            {money(cents(v.revenue))}) − despesas (R$ {money(cents(v.expenses))}
            ) ={" "}
            <strong>
              {result.netCents < 0 ? "−" : ""}R${" "}
              {money(Math.abs(result.netCents))}
            </strong>
          </li>
          <li>
            <strong>Teto do período</strong> = R${" "}
            {money(result.ceilingMonthCents)} × {months} ={" "}
            <strong>R$ {money(result.limitCents)}</strong>
          </li>
          <li>
            <strong>Comparação</strong>: a renda líquida{" "}
            {over ? "ultrapassou" : "não ultrapassou"} o teto do período.
          </li>
        </ol>
        <div
          className={`rounded-[12px] border px-4 py-3.5 ${over ? "border-admin-warning-soft-border bg-admin-warning-soft-bg text-admin-warning-text" : "border-admin-success-bg bg-admin-success-bg text-admin-success-text"}`}
        >
          <p className="text-[17px] font-bold">
            {over
              ? `Excedente a depositar: R$ ${money(result.excessCents)}`
              : "Não há excedente a depositar."}
          </p>
          <p className="mt-1 text-[13px]">
            O interino fica com R$ {money(result.interimPayCents)}.
            {over
              ? " O excedente é depositado à disposição do Tribunal de Justiça e lançado no Livro Diário Auxiliar, com a data do depósito e a conta (art. 194, I)."
              : ""}
          </p>
          {over && (
            <a
              href="/admin/utilitarios/livro-diario/lancamento?tipo=deposito"
              className="mt-2 inline-block text-[13px] font-semibold underline"
            >
              Lançar o depósito no livro
            </a>
          )}
        </div>
      </Step>

      <section className="flex flex-col gap-3 rounded-[14px] border border-admin-border bg-admin-card px-5 py-4">
        <div>
          <label htmlFor="ex-notes" className={LABEL}>
            Observações (saem no PDF)
          </label>
          <input
            id="ex-notes"
            name="observacoes"
            maxLength={5000}
            value={v.notes}
            onChange={set("notes")}
            className={FIELD}
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="btn btn-admin-primary btn-md self-start"
        >
          {pending
            ? "Salvando..."
            : initial.id
              ? "Salvar alterações"
              : "Salvar o cálculo e gerar o PDF"}
        </button>
        <span className={HINT}>
          O PDF (memória de cálculo) pode ser assinado digitalmente ou impresso
          para assinatura à mão.
        </span>
      </section>
    </form>
  );
}

/** A numbered step of the calculator. */
function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-[14px] border border-admin-border bg-admin-card px-5 py-4">
      <h2 className="flex items-center gap-2.5 font-serif text-[17px] font-semibold text-admin-primary">
        <span className="inline-flex h-7 w-7 flex-none items-center justify-center rounded-full bg-admin-primary text-[13px] font-bold text-white">
          {n}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function RemoveExcessButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(removeExcess, IDLE);
  return (
    <ConfirmAction
      action={action}
      pending={pending}
      error={state.status === "error" ? state.message : null}
      trigger="Excluir"
      question="Excluir este cálculo?"
      consequence="Ele sai da lista, mas continua guardado, com a justificativa."
      confirmLabel="Excluir"
      pendingLabel="Excluindo..."
    >
      <input type="hidden" name="id" value={id} />
    </ConfirmAction>
  );
}
