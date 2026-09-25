"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useOptimistic,
  useState,
} from "react";
import { toast } from "sonner";
import {
  BALANCE_LABEL,
  bulletinView,
  formatMoneyBRL,
  fundFieldName,
  MONTHS_PT,
  parseCount,
  parseMoneyBRL,
} from "@/core/transparency/bulletin.ts";
import {
  FUNDS_BY_STATE,
  type SupportedState,
} from "@/core/transparency/rubrics.ts";
import {
  type ActionState,
  publishBulletinAction,
  type SaveState,
  saveBulletinOptionAction,
} from "../actions.ts";
import { BulletinPreview } from "./bulletin-preview.tsx";

const FIELD_CLASS =
  "w-full rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3.5 py-2.5 text-[13.5px] text-admin-text outline-none focus:border-admin-primary-soft";
const ERROR_FIELD_CLASS =
  "w-full rounded-[9px] border border-admin-error-border bg-admin-error-input-bg px-3.5 py-2.5 text-[13.5px] text-admin-text outline-none focus:border-admin-error-text";
const LABEL_CLASS = "mb-1.5 block text-xs font-bold text-admin-primary";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1.5 text-xs font-semibold text-admin-error-text">
      {message}
    </p>
  );
}

function MoneyField({
  id,
  name,
  label,
  hint,
  value,
  onChange,
  error,
}: {
  id: string;
  name: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className={LABEL_CLASS}>
        {label} (R$)
        {hint && <span className="font-medium text-admin-faint"> {hint}</span>}
      </label>
      <input
        id={id}
        name={name}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={error ? ERROR_FIELD_CLASS : FIELD_CLASS}
      />
      <FieldError message={error} />
    </div>
  );
}

/** What the form and preview need about the office, as one prop. */
export interface BulletinOffice {
  name: string;
  subtitle: string;
  legalFooter: string;
  city: string;
  state: SupportedState;
  publishPrivateFigures: boolean;
}

/**
 * The office-wide choice to publish gross revenue, expenses and the balance.
 * Saved on its own, the moment it is flipped: it is a setting, not part of a
 * month's bulletin, and it changes every month already on the site.
 */
function BulletinOption({ enabled }: { enabled: boolean }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    saveBulletinOptionAction,
    { status: "idle" },
  );
  // The switch moves on the click, not when the page comes back: the save
  // re-renders the whole tab, and a switch that sits still for that long
  // reads as a click that did not take. A failed save drops the optimistic
  // value and the switch returns to what the server holds.
  const [shown, setShown] = useOptimistic(enabled);

  useEffect(() => {
    if (state.status === "error") toast.error(state.message);
  }, [state]);

  return (
    <form
      action={(formData) => {
        setShown(!enabled);
        formAction(formData);
      }}
      className="flex items-start justify-between gap-4 rounded-[14px] border border-admin-border bg-admin-card p-5"
    >
      <div>
        <p
          id="bulletin-option-label"
          className="text-[13.5px] font-semibold text-admin-primary"
        >
          Publicar também arrecadação, despesas e saldo
        </p>
        <p className="mt-1 max-w-[62ch] text-[12.5px] leading-relaxed text-admin-muted">
          A norma exige só os valores recolhidos aos fundos. Arrecadação,
          despesas e saldo são da serventia e saem no site só se esta opção
          estiver ligada. Desligar tira esses números de todos os boletins, os
          já publicados também.
        </p>
      </div>
      <input
        type="hidden"
        name="publishBulletinPrivateFigures"
        value={enabled ? "false" : "true"}
      />
      <button
        type="submit"
        role="switch"
        aria-checked={shown}
        aria-labelledby="bulletin-option-label"
        disabled={pending}
        className={`relative mt-0.5 h-5.5 w-10 flex-none rounded-full transition-colors ${
          shown ? "bg-admin-primary" : "bg-admin-readonly-bg"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white transition-all ${
            shown ? "left-5" : "left-0.5"
          }`}
        />
      </button>
    </form>
  );
}

export function BulletinForm({
  office,
  currentMonth,
  currentYear,
}: {
  office: BulletinOffice;
  currentMonth: number;
  currentYear: number;
}) {
  const [state, formAction, pending] = useActionState<SaveState, FormData>(
    publishBulletinAction,
    { status: "idle" },
  );
  const fieldErrors = state.status === "error" ? state.fieldErrors : {};
  const funds = FUNDS_BY_STATE[office.state];

  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentYear);
  const [acts, setActs] = useState("");
  const [fundValues, setFundValues] = useState<Record<string, string>>({});
  const [iss, setIss] = useState("");
  const [gross, setGross] = useState("");
  const [expenses, setExpenses] = useState("");
  const [status, setStatus] = useState<"preliminary" | "consolidated">(
    "preliminary",
  );

  useEffect(() => {
    if (state.status === "success") toast.success("Boletim publicado no site.");
  }, [state]);

  // The preview never shows a blank: anything unparseable reads as zero, so
  // the operator always sees a coherent boletim taking shape as they type.
  // That zero lives only here; the action parses the typed strings again and
  // refuses a blank.
  const view = useMemo(() => {
    const fundAmountsCents: Record<string, number> = {};
    for (const fund of funds) {
      fundAmountsCents[fund.key] =
        parseMoneyBRL(fundValues[fund.key] ?? "") ?? 0;
    }
    return bulletinView(
      office.state,
      {
        actsCount: parseCount(acts) ?? 0,
        fundAmountsCents,
        issCents: parseMoneyBRL(iss) ?? 0,
        grossRevenueCents: parseMoneyBRL(gross) ?? 0,
        expensesCents: parseMoneyBRL(expenses) ?? 0,
      },
      office.publishPrivateFigures,
    );
  }, [
    acts,
    fundValues,
    iss,
    gross,
    expenses,
    funds,
    office.state,
    office.publishPrivateFigures,
  ]);
  const privateFigures = view.privateFigures;

  return (
    <div className="space-y-5">
      <BulletinOption enabled={office.publishPrivateFigures} />

      <div className="grid gap-5 lg:grid-cols-2">
        <form
          action={formAction}
          className="rounded-[14px] border border-admin-border bg-admin-card p-5"
        >
          <h3 className="font-serif text-[16px] font-semibold text-admin-primary">
            Novo boletim
          </h3>
          <p className="mt-1 text-[12.5px] text-admin-muted">
            Digite os valores do mês como aparecem nas guias de recolhimento.{" "}
            {office.publishPrivateFigures
              ? "Os totais e o saldo são calculados automaticamente."
              : "Os totais são calculados automaticamente."}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="b-month" className={LABEL_CLASS}>
                Mês
              </label>
              <select
                id="b-month"
                name="month"
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className={fieldErrors.month ? ERROR_FIELD_CLASS : FIELD_CLASS}
              >
                {MONTHS_PT.map((label, i) => (
                  <option key={label} value={i + 1}>
                    {label}
                  </option>
                ))}
              </select>
              <FieldError message={fieldErrors.month} />
            </div>
            <div>
              <label htmlFor="b-year" className={LABEL_CLASS}>
                Ano
              </label>
              <input
                id="b-year"
                name="year"
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className={fieldErrors.year ? ERROR_FIELD_CLASS : FIELD_CLASS}
              />
              <FieldError message={fieldErrors.year} />
            </div>
          </div>

          <div className="mt-3.5 grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="b-acts" className={LABEL_CLASS}>
                Atos praticados
              </label>
              <input
                id="b-acts"
                name="actsCount"
                inputMode="numeric"
                value={acts}
                onChange={(e) => setActs(e.target.value)}
                className={
                  fieldErrors.actsCount ? ERROR_FIELD_CLASS : FIELD_CLASS
                }
              />
              <FieldError message={fieldErrors.actsCount} />
            </div>
            {office.publishPrivateFigures && (
              <MoneyField
                id="b-gross"
                name="grossRevenue"
                label="Arrecadação do mês"
                value={gross}
                onChange={setGross}
                error={fieldErrors.grossRevenue}
              />
            )}
          </div>

          <fieldset className="mt-4">
            <legend className="text-[11px] font-bold uppercase tracking-[0.08em] text-admin-accent">
              Recolhido aos fundos
            </legend>
            <div className="mt-2 grid grid-cols-2 gap-3">
              {funds.map((fund) => (
                <MoneyField
                  key={fund.key}
                  id={`b-${fundFieldName(fund.key)}`}
                  name={fundFieldName(fund.key)}
                  label={fund.label}
                  value={fundValues[fund.key] ?? ""}
                  onChange={(value) =>
                    setFundValues((current) => ({
                      ...current,
                      [fund.key]: value,
                    }))
                  }
                  error={fieldErrors[fundFieldName(fund.key)]}
                />
              ))}
            </div>
          </fieldset>

          <div className="mt-3.5 grid grid-cols-2 gap-3">
            <MoneyField
              id="b-iss"
              name="iss"
              label="ISS"
              hint={`tributo municipal (${office.city})`}
              value={iss}
              onChange={setIss}
              error={fieldErrors.iss}
            />
            {office.publishPrivateFigures && (
              <MoneyField
                id="b-expenses"
                name="expenses"
                label="Despesas"
                value={expenses}
                onChange={setExpenses}
                error={fieldErrors.expenses}
              />
            )}
          </div>

          {/* Calculated, never an input: the saldo is the one figure the
              office is promised it will not have to type or reconcile. */}
          {privateFigures && (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-[10px] bg-admin-success-bg px-4 py-3">
              <span className="text-[12.5px] font-bold text-admin-success-text">
                {BALANCE_LABEL}, calculado
              </span>
              <span className="font-serif text-[17px] font-bold text-admin-success-text tabular-nums">
                R$ {formatMoneyBRL(privateFigures.balanceCents)}
              </span>
            </div>
          )}

          <div className="mt-4">
            <span className={LABEL_CLASS}>Situação</span>
            <div className="flex w-fit gap-1 rounded-[10px] border border-admin-input-border bg-admin-input-bg p-1">
              {(["preliminary", "consolidated"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  aria-pressed={status === s}
                  className={
                    status === s
                      ? "rounded-lg bg-admin-primary px-4 py-1.5 text-[12.5px] font-bold text-white"
                      : "rounded-lg px-4 py-1.5 text-[12.5px] font-semibold text-admin-muted"
                  }
                >
                  {s === "preliminary" ? "Preliminar" : "Consolidado"}
                </button>
              ))}
            </div>
            <input type="hidden" name="bulletinStatus" value={status} />
            <p className="mt-1.5 text-[11.5px] text-admin-faint">
              Preliminar sai no site com a etiqueta "Dados preliminares".
            </p>
          </div>

          {state.status === "error" && !Object.keys(fieldErrors).length && (
            <p
              role="alert"
              className="mt-3 text-[12.5px] font-semibold text-admin-error-text"
            >
              {state.message}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="btn btn-admin-primary btn-lg mt-4 w-full"
          >
            {pending ? "Publicando…" : "Publicar no site"}
          </button>
        </form>

        <div>
          <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.08em] text-admin-accent">
            Pré-visualização do PDF · como sai no site
          </p>
          <BulletinPreview
            officeName={office.name}
            officeSubtitle={office.subtitle}
            legalFooter={office.legalFooter}
            city={office.city}
            month={month}
            year={year}
            view={view}
            status={status}
          />
        </div>
      </div>
    </div>
  );
}
