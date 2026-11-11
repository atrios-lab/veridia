"use client";

import { useActionState, useMemo, useState } from "react";
import { competenceLabel, formatRate, issOn } from "@/core/iss/declaration.ts";
import { formatMoneyBRL, parseMoneyBRL } from "@/core/transparency/bulletin.ts";
import { type IssFormState, saveIssDeclaration } from "./actions.ts";

const FIELD =
  "w-full rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3.5 py-2.5 text-[13.5px] text-admin-text outline-none focus:border-admin-primary-soft";
const LABEL = "mb-1.5 block text-xs font-bold text-admin-primary";
const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export interface IssFormInitial {
  id?: string;
  /** Today in the office's calendar ("YYYY-MM-DD"). */
  today: string;
  competence: string;
  emoluments: string;
  rate: string;
  damNumber: string;
  dueDate: string;
  paidOn: string;
  notes: string;
  attachmentName?: string | null;
}

/**
 * The month's figures, simple on purpose: the competence, the emolumentos
 * (the ISS base) and the rate; the ISS is worked out as it is typed. The
 * book of the month goes attached; the declaration ratifies it.
 */
export function IssForm({ initial }: { initial: IssFormInitial }) {
  const [state, action, pending] = useActionState<IssFormState, FormData>(
    saveIssDeclaration,
    { status: "idle" },
  );
  const [year, month] = initial.competence.split("-");
  const [emoluments, setEmoluments] = useState(initial.emoluments);
  const [rate, setRate] = useState(initial.rate);
  const [chosenMonth, setChosenMonth] = useState(Number(month));
  const [chosenYear, setChosenYear] = useState(Number(year));
  const iss = useMemo(() => {
    const cents = parseMoneyBRL(emoluments);
    const basis = Math.round(Number(rate.replace(",", ".")) * 100);
    if (cents === null || !basis) return null;
    return { cents: issOn(cents, basis), basis };
  }, [emoluments, rate]);
  // The years offered: the competence's own and the two before it.
  const thisYear = Math.max(Number(year), Number(initial.today.slice(0, 4)));

  return (
    <form
      action={action}
      className="rounded-[14px] border border-admin-border bg-admin-card px-5 py-4"
    >
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-4">
        <div>
          <label htmlFor="iss-mes" className={LABEL}>
            Competência: mês
          </label>
          <select
            id="iss-mes"
            name="mes"
            value={chosenMonth}
            onChange={(event) => setChosenMonth(Number(event.target.value))}
            className={FIELD}
          >
            {MONTHS.map((name, index) => (
              <option key={name} value={index + 1}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="iss-ano" className={LABEL}>
            Ano
          </label>
          <select
            id="iss-ano"
            name="ano"
            value={chosenYear}
            onChange={(event) => setChosenYear(Number(event.target.value))}
            className={FIELD}
          >
            {[thisYear - 2, thisYear - 1, thisYear].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label htmlFor="iss-emolumentos" className={LABEL}>
            Emolumentos do mês (base de cálculo)
          </label>
          <input
            id="iss-emolumentos"
            name="emolumentos"
            inputMode="decimal"
            required
            placeholder="0,00"
            value={emoluments}
            onChange={(event) => setEmoluments(event.target.value)}
            className={FIELD}
          />
          <p className="mt-1 text-[11.5px] text-admin-muted">
            Só os emolumentos, sem FDJ, FRMP, FCRCPN, FUNAF nem selo: esses são
            repasses, não preço do serviço.
          </p>
        </div>
        <div>
          <label htmlFor="iss-aliquota" className={LABEL}>
            Alíquota (%)
          </label>
          <input
            id="iss-aliquota"
            name="aliquota"
            inputMode="decimal"
            value={rate}
            onChange={(event) => setRate(event.target.value)}
            className={FIELD}
          />
        </div>
        <div className="flex flex-col justify-end rounded-[12px] bg-admin-input-bg px-4 py-2.5 md:col-span-3">
          <span className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-admin-muted">
            ISS de{" "}
            {competenceLabel(
              `${chosenYear}-${String(chosenMonth).padStart(2, "0")}`,
            )}
          </span>
          <span className="font-serif text-[24px] font-semibold text-admin-primary">
            {iss ? `R$ ${formatMoneyBRL(iss.cents)}` : "R$ 0,00"}
          </span>
          {iss && (
            <span className="text-[11.5px] text-admin-muted">
              {formatRate(iss.basis)} sobre R$ {emoluments}
            </span>
          )}
        </div>
        <div className="md:col-span-4">
          <label htmlFor="iss-livro" className={LABEL}>
            Livro Diário Auxiliar ou relatório do caixa do mês (PDF)
          </label>
          <input
            id="iss-livro"
            type="file"
            name="livro"
            accept="application/pdf,.pdf"
            className="block w-full text-[13px] file:mr-3 file:rounded-full file:border-0 file:bg-admin-primary file:px-4 file:py-2 file:text-[12.5px] file:font-semibold file:text-white"
          />
          <p className="mt-1 text-[11.5px] text-admin-muted">
            {initial.attachmentName
              ? `Anexado: ${initial.attachmentName}. Envie outro só para trocar.`
              : "Vai junto da declaração, no mesmo PDF; a declaração o ratifica."}
          </p>
        </div>
        <details className="md:col-span-4 rounded-[12px] bg-admin-input-bg px-3.5 py-2.5">
          <summary className="cursor-pointer text-[12.5px] font-semibold text-admin-primary">
            Recolhimento e observações (opcional)
          </summary>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className={LABEL}>
              Nº do DAM/guia
              <input
                name="dam"
                defaultValue={initial.damNumber}
                className={`${FIELD} mt-1.5 font-normal`}
              />
            </label>
            <label className={LABEL}>
              Vencimento
              <input
                type="date"
                name="vencimento"
                defaultValue={initial.dueDate}
                className={`${FIELD} mt-1.5 font-normal`}
              />
            </label>
            <label className={LABEL}>
              Recolhido em
              <input
                type="date"
                name="pagamento"
                defaultValue={initial.paidOn}
                className={`${FIELD} mt-1.5 font-normal`}
              />
            </label>
            <label className={`${LABEL} md:col-span-3`}>
              Observações
              <textarea
                name="observacoes"
                rows={2}
                defaultValue={initial.notes}
                className={`${FIELD} mt-1.5 font-normal`}
              />
            </label>
          </div>
        </details>
        <label className="flex items-center gap-2 text-[13px] text-admin-text md:col-span-4">
          <input
            type="checkbox"
            name="boletim"
            defaultChecked
            className="checkbox-admin"
          />
          Lançar este ISS no boletim mensal da transparência
        </label>
      </div>
      {state.status === "error" && (
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
        className="btn btn-admin-primary btn-md mt-4"
      >
        {pending
          ? "Salvando..."
          : initial.id
            ? "Salvar correção"
            : "Gerar declaração"}
      </button>
    </form>
  );
}
