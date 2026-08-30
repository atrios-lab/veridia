"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  bulletinBalanceCents,
  formatMoneyBRL,
  MONTHS_PT,
  parseCount,
  parseMoneyBRL,
} from "@/core/transparency/bulletin.ts";
import { publishBulletinAction, type SaveState } from "../actions.ts";
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

/** What the preview needs about the office; the form takes it as one prop. */
export interface BulletinOffice {
  name: string;
  subtitle: string;
  legalFooter: string;
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

  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentYear);
  const [acts, setActs] = useState("");
  const [gross, setGross] = useState("");
  const [taxes, setTaxes] = useState("");
  const [expenses, setExpenses] = useState("");
  const [status, setStatus] = useState<"preliminary" | "consolidated">(
    "preliminary",
  );

  useEffect(() => {
    if (state.status === "success") toast.success("Boletim publicado no site.");
  }, [state]);

  // The preview never shows a blank: anything unparseable reads as zero, so
  // the operator always sees a coherent boletim taking shape as they type.
  const figures = useMemo(
    () => ({
      actsCount: parseCount(acts) ?? 0,
      grossRevenueCents: parseMoneyBRL(gross) ?? 0,
      taxesPaidCents: parseMoneyBRL(taxes) ?? 0,
      expensesCents: parseMoneyBRL(expenses) ?? 0,
    }),
    [acts, gross, taxes, expenses],
  );
  const balance = bulletinBalanceCents(figures);

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <form
        action={formAction}
        className="rounded-[14px] border border-admin-border bg-admin-card p-5"
      >
        <h3 className="font-serif text-[16px] font-semibold text-admin-primary">
          Novo boletim
        </h3>
        <p className="mt-1 text-[12.5px] text-admin-muted">
          Digite os valores do mês. O saldo é calculado automaticamente.
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

        <div className="mt-3.5">
          <label htmlFor="b-acts" className={LABEL_CLASS}>
            Atos praticados
          </label>
          <input
            id="b-acts"
            name="actsCount"
            inputMode="numeric"
            value={acts}
            onChange={(e) => setActs(e.target.value)}
            className={fieldErrors.actsCount ? ERROR_FIELD_CLASS : FIELD_CLASS}
          />
          <FieldError message={fieldErrors.actsCount} />
        </div>

        <div className="mt-3.5">
          <label htmlFor="b-gross" className={LABEL_CLASS}>
            Arrecadação bruta do mês (R$)
          </label>
          <input
            id="b-gross"
            name="grossRevenue"
            inputMode="decimal"
            value={gross}
            onChange={(e) => setGross(e.target.value)}
            className={
              fieldErrors.grossRevenue ? ERROR_FIELD_CLASS : FIELD_CLASS
            }
          />
          <FieldError message={fieldErrors.grossRevenue} />
        </div>

        <div className="mt-3.5">
          <label htmlFor="b-taxes" className={LABEL_CLASS}>
            Tributos pagos (R$){" "}
            <span className="font-medium text-admin-faint">
              FCRCPN, FRMP, FDJ, FUNAF, ISS
            </span>
          </label>
          <input
            id="b-taxes"
            name="taxesPaid"
            inputMode="decimal"
            value={taxes}
            onChange={(e) => setTaxes(e.target.value)}
            className={fieldErrors.taxesPaid ? ERROR_FIELD_CLASS : FIELD_CLASS}
          />
          <FieldError message={fieldErrors.taxesPaid} />
        </div>

        <div className="mt-3.5">
          <label htmlFor="b-expenses" className={LABEL_CLASS}>
            Despesas (R$)
          </label>
          <input
            id="b-expenses"
            name="expenses"
            inputMode="decimal"
            value={expenses}
            onChange={(e) => setExpenses(e.target.value)}
            className={fieldErrors.expenses ? ERROR_FIELD_CLASS : FIELD_CLASS}
          />
          <FieldError message={fieldErrors.expenses} />
        </div>

        {/* Calculated, never an input: the saldo is the one figure the office
            is promised it will not have to type or reconcile. */}
        <div className="mt-4 flex items-center justify-between gap-3 rounded-[10px] bg-admin-success-bg px-4 py-3">
          <span className="text-[12.5px] font-bold text-admin-success-text">
            Saldo final (calculado)
          </span>
          <span className="font-serif text-[17px] font-bold text-admin-success-text tabular-nums">
            R$ {formatMoneyBRL(balance)}
          </span>
        </div>

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
          month={month}
          year={year}
          figures={figures}
          status={status}
        />
      </div>
    </div>
  );
}
