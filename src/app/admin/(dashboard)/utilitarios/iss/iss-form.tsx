"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { competenceLabel, formatRate, issOn } from "@/core/iss/declaration.ts";
import { LONG_TEXT_MAX } from "@/core/text-limits.ts";
import { formatMoneyBRL, parseMoneyBRL } from "@/core/transparency/bulletin.ts";
import {
  type IssFormState,
  readIssReports,
  saveIssDeclaration,
} from "./actions.ts";

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
  /** Who signs: index into the office's signers. */
  signer?: number;
  /** The ISS of the system's report (act by act), when it was used. */
  issFromReport?: string;
  attachmentNames?: string[];
}

/**
 * The bulletin's figures read from the productivity report, by field: the
 * acts, each of the State's funds, the intake and the costs.
 */
type BulletinRead = Record<string, string>;

/** The State's funds the office passes on to (they differ by State). */
export interface IssFormOffice {
  uf: string;
  funds: { key: string; label: string }[];
  /** May publish the bulletin to the site (Transparência permission). */
  canPublish?: boolean;
  /** Who may sign (the office's list, the same as the guias'). */
  signers?: { name: string; title: string }[];
}

const money = (cents: number | undefined) =>
  cents === undefined ? "" : formatMoneyBRL(cents);

/**
 * The month's figures, simple on purpose: the competence, the emolumentos
 * (the ISS base) and the rate; the ISS is worked out as it is typed. The
 * book and the system's reports go attached; the declaration ratifies them.
 * Attaching the system's reports (productivity, taxes) fills everything in,
 * the ISS act by act and the month's bulletin included; all stays editable.
 */
export function IssForm({
  initial,
  state: office,
}: {
  initial: IssFormInitial;
  state: IssFormOffice;
}) {
  const bulletinFields = [
    { key: "atos", label: "Atos praticados" },
    ...office.funds,
    { key: "arrecadacao", label: "Arrecadação total bruta [E]" },
    { key: "despesas", label: "Custeio (despesas) [C]" },
  ];
  const fundNames = office.funds.map((f) => f.label).join(", ");
  const [state, action, pending] = useActionState<IssFormState, FormData>(
    saveIssDeclaration,
    { status: "idle" },
  );
  const [year, month] = initial.competence.split("-");
  const [emoluments, setEmoluments] = useState(initial.emoluments);
  const [rate, setRate] = useState(initial.rate);
  const [chosenMonth, setChosenMonth] = useState(Number(month));
  const [chosenYear, setChosenYear] = useState(Number(year));
  const [byAct, setByAct] = useState(Boolean(initial.issFromReport));
  const [reportIss, setReportIss] = useState(initial.issFromReport ?? "");
  const [bulletin, setBulletin] = useState<BulletinRead | null>(null);
  const [reading, startReading] = useTransition();
  const [readNote, setReadNote] = useState<string | null>(null);
  // The figures came from a report: someone has to check them before the
  // declaration (and the bulletin) go out (decision of 11/11/2026).
  const [readFromReport, setReadFromReport] = useState(false);
  const [bulletinChoice, setBulletinChoice] = useState<
    "rascunho" | "publicar" | "nao"
  >("rascunho");
  const iss = useMemo(() => {
    const cents = parseMoneyBRL(emoluments);
    const basis = Math.round(Number(rate.replace(",", ".")) * 100);
    if (cents === null || !basis) return null;
    return { cents: issOn(cents, basis), basis };
  }, [emoluments, rate]);

  function readReports(files: FileList | null) {
    if (!files || files.length === 0) return;
    const sent = new FormData();
    for (const file of Array.from(files)) sent.append("livro", file);
    setReadNote(null);
    startReading(async () => {
      const result = await readIssReports(sent);
      if (result.status === "error") {
        setReadNote(result.message);
        return;
      }
      const f = result.figures;
      if (f.competence) {
        setChosenYear(Number(f.competence.slice(0, 4)));
        setChosenMonth(Number(f.competence.slice(5, 7)));
      }
      if (f.emolumentsCents !== undefined)
        setEmoluments(money(f.emolumentsCents));
      if (f.rateBasisPoints) {
        setRate((f.rateBasisPoints / 100).toFixed(2).replace(".", ","));
      }
      if (f.issCents !== undefined) {
        setByAct(true);
        setReportIss(money(f.issCents));
      }
      if (
        f.kind === "produtividade" ||
        f.funds ||
        f.grossRevenueCents !== undefined
      ) {
        const read: BulletinRead = {
          atos: f.actsCount === undefined ? "" : String(f.actsCount),
          arrecadacao: money(f.grossRevenueCents),
          despesas: money(f.expensesCents),
        };
        // Only the funds this State has; a report's other columns stay out.
        for (const fund of office.funds) {
          read[fund.key] = money(
            f.funds?.[fund.key as keyof NonNullable<typeof f.funds>],
          );
        }
        setBulletin(read);
      }
      const read = f.kind !== "desconhecido";
      if (read) setReadFromReport(true);
      setReadNote(
        read
          ? `Lido do relatório${result.unread.length ? ` (não reconhecido: ${result.unread.join(", ")})` : ""}. Confira os valores abaixo; tudo pode ser corrigido.`
          : "Anexado. Não reconheci um relatório do sistema nesses arquivos: digite os valores.",
      );
    });
  }
  // The years offered: the competence's own and the two before it.
  const thisYear = Math.max(Number(year), Number(initial.today.slice(0, 4)));

  return (
    <form
      action={action}
      className="rounded-[14px] border border-admin-border bg-admin-card px-5 py-4"
    >
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-4">
        <div className="rounded-[12px] border border-dashed border-admin-primary-soft bg-admin-input-bg px-4 py-3 md:col-span-4">
          <label htmlFor="iss-livro" className={LABEL}>
            Livro Diário Auxiliar e relatórios do mês (PDF, um ou mais)
          </label>
          <input
            id="iss-livro"
            type="file"
            name="livro"
            multiple
            accept="application/pdf,.pdf"
            onChange={(event) => readReports(event.target.files)}
            className="block w-full text-[13px] file:mr-3 file:rounded-full file:border-0 file:bg-admin-primary file:px-4 file:py-2 file:text-[12.5px] file:font-semibold file:text-white"
          />
          <p className="mt-1 text-[11.5px] text-admin-muted" aria-live="polite">
            {reading
              ? "Lendo os relatórios..."
              : (readNote ??
                (initial.attachmentNames?.length
                  ? `Anexados: ${initial.attachmentNames.join(", ")}. Envie de novo só para trocar.`
                  : "Anexe o relatório de produtividade e o de valores tributários do sistema: os campos se preenchem sozinhos. Vão junto da declaração, no mesmo PDF, e a declaração os ratifica."))}
          </p>
        </div>
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
            Só os emolumentos. Ficam de fora os repasses a terceiros (taxa de
            fiscalização, fundos do Estado, selo)
            {fundNames ? `: no ${office.uf}, ${fundNames}` : ""}. Eles não são
            preço do serviço.
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
          {byAct ? (
            <label className="mt-0.5 flex items-center gap-1.5 font-serif text-[24px] font-semibold text-admin-primary">
              R$
              <input
                name="iss"
                inputMode="decimal"
                aria-label="ISS apurado ato a ato"
                value={reportIss}
                onChange={(event) => setReportIss(event.target.value)}
                className="w-40 rounded-[8px] border border-admin-input-border bg-admin-card px-2 py-0.5 font-serif text-[22px] outline-none focus:border-admin-primary-soft"
              />
            </label>
          ) : (
            <span className="font-serif text-[24px] font-semibold text-admin-primary">
              {iss ? `R$ ${formatMoneyBRL(iss.cents)}` : "R$ 0,00"}
            </span>
          )}
          <span className="text-[11.5px] text-admin-muted">
            {byAct
              ? `Apurado ato a ato no relatório${iss ? ` (${formatRate(iss.basis)} sobre o total daria R$ ${formatMoneyBRL(iss.cents)}; atos sem ISS explicam a diferença)` : ""}.`
              : iss
                ? `${formatRate(iss.basis)} sobre R$ ${emoluments}`
                : ""}
          </span>
          <label className="mt-1.5 flex items-center gap-2 text-[12px] text-admin-text">
            <input
              type="checkbox"
              name="iss_relatorio"
              checked={byAct}
              onChange={(event) => {
                setByAct(event.target.checked);
                if (event.target.checked && !reportIss && iss) {
                  setReportIss(formatMoneyBRL(iss.cents));
                }
              }}
              className="checkbox-admin"
            />
            Usar o ISS do relatório do sistema (ato a ato)
          </label>
        </div>
        <div className="md:col-span-2">
          <label htmlFor="iss-assina" className={LABEL}>
            Quem assina
          </label>
          <select
            id="iss-assina"
            name="assina"
            defaultValue={String(initial.signer ?? 0)}
            className={FIELD}
          >
            {(office.signers?.length
              ? office.signers
              : [{ name: "Titular da serventia", title: "" }]
            ).map((signer, index) => (
              <option key={`${signer.name}-${index}`} value={index}>
                {[signer.name, signer.title].filter(Boolean).join(", ")}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11.5px] text-admin-muted">
            Edite a lista na configuração do ISS ou em Configurações › Quem
            assina (é a mesma das guias). Vale para a assinatura digital e para
            a impressa.
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
                maxLength={LONG_TEXT_MAX}
                defaultValue={initial.notes}
                className={`${FIELD} mt-1.5 font-normal`}
              />
            </label>
          </div>
        </details>
        <fieldset className="flex flex-col gap-1.5 text-[13px] text-admin-text md:col-span-4">
          <legend className="mb-1 text-xs font-bold text-admin-primary">
            Boletim mensal da transparência
          </legend>
          {(
            [
              [
                "rascunho",
                bulletin
                  ? "Preencher o boletim com estes números (publico depois, em Transparência)"
                  : "Lançar este ISS no boletim (publico depois, em Transparência)",
              ],
              ...(bulletin && office.canPublish
                ? ([
                    [
                      "publicar",
                      "Preencher e publicar o boletim agora no site",
                    ],
                  ] as const)
                : []),
              ["nao", "Não mexer no boletim"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex items-center gap-2">
              <input
                type="radio"
                name="boletim"
                value={value}
                checked={bulletinChoice === value}
                onChange={() => setBulletinChoice(value)}
              />
              {label}
            </label>
          ))}
        </fieldset>
        {bulletin && (
          <fieldset className="rounded-[12px] bg-admin-input-bg px-3.5 py-3 md:col-span-4">
            <legend className="px-1 text-[12.5px] font-semibold text-admin-primary">
              Boletim mensal, lido do relatório de produtividade
            </legend>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {bulletinFields.map(({ key, label }) => (
                <label key={key} className={LABEL}>
                  {label}
                  <input
                    name={`b_${key}`}
                    inputMode={key === "atos" ? "numeric" : "decimal"}
                    value={bulletin[key] ?? ""}
                    onChange={(event) =>
                      setBulletin({ ...bulletin, [key]: event.target.value })
                    }
                    className={`${FIELD} mt-1.5 font-normal`}
                  />
                </label>
              ))}
            </div>
            <p className="mt-2 text-[11.5px] text-admin-muted">
              {bulletinChoice === "publicar"
                ? "O boletim vai para o site assim que a declaração for gerada, como consolidado. Dá para corrigir depois em Transparência."
                : "O boletim não é publicado sozinho: ao abrir o mês em Transparência, ele já vem preenchido para você conferir e publicar."}
            </p>
          </fieldset>
        )}
        {readFromReport && (
          <div className="rounded-[12px] border border-admin-warning-soft-border bg-admin-warning-bg px-4 py-3 text-[13px] text-admin-warning-text md:col-span-4">
            <p className="font-semibold">
              Conferência: os valores acima foram lidos do relatório pelo
              sistema.
            </p>
            <p className="mt-0.5">
              Antes de gerar, confira competência, emolumentos, ISS e os números
              do boletim com o relatório. A conferência fica registrada na
              auditoria com o seu nome.
            </p>
            <input type="hidden" name="lido" value="1" />
            <label className="mt-2 flex items-start gap-2 font-semibold">
              <input
                type="checkbox"
                name="conferido"
                required
                className="checkbox-admin mt-0.5"
              />
              Conferi os valores lidos com o relatório e estão corretos.
            </label>
          </div>
        )}
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
