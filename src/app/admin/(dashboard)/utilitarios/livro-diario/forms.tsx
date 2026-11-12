"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import {
  expenseWarnings,
  PERSONAL_EXPENSE_RULE,
  RECEIPTS_RULE,
} from "@/core/daily-book/checks.ts";
import { ConfirmAction } from "../../../_components/confirm-action.tsx";
import {
  type BookFormState,
  editReport,
  importProductivity,
  issueReport,
  type ReadLine,
  readProductivity,
  readReceipt,
  removeEntry,
  removeReport,
  saveEntry,
  saveSettings,
} from "./actions.ts";

const FIELD =
  "w-full rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3.5 py-2.5 text-[13.5px] text-admin-text outline-none focus:border-admin-primary-soft";
const SMALL =
  "w-full rounded-[8px] border border-admin-input-border bg-admin-input-bg px-2.5 py-1.5 text-[12.5px] text-admin-text outline-none focus:border-admin-primary-soft";
const LABEL = "mb-1.5 block text-[12.5px] font-semibold text-admin-text";
const HINT = "mt-1 block text-[11.5px] text-admin-muted";
const CARD =
  "flex flex-col gap-4 rounded-[14px] border border-admin-border bg-admin-card px-5 py-5";
const IDLE: BookFormState = { status: "idle" };

const money = (c: number) =>
  (c / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const br = (iso: string) => iso.split("-").reverse().join("/");

function Feedback({ state }: { state: BookFormState }) {
  useEffect(() => {
    if (state.status === "saved") toast.success(state.message);
  }, [state]);
  if (state.status !== "error") return null;
  return (
    <p
      role="alert"
      className="rounded-[10px] bg-admin-error-bg px-3.5 py-2.5 text-[13px] font-semibold text-admin-error-text"
    >
      {state.message}
    </p>
  );
}

function Submit({
  pending,
  label,
  busy,
}: {
  pending: boolean;
  label: string;
  busy: string;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn btn-admin-primary btn-md self-start"
    >
      {pending ? busy : label}
    </button>
  );
}

/* ----------------------------------------------------------- productivity */

interface Row extends ReadLine {
  key: number;
  amount: string;
  /** Art. 190: the act's number, or book and sheet, or protocol. */
  identification: string;
  explanation: string;
}

export function ImportForm({ specialties }: { specialties: string[] }) {
  const [state, action, pending] = useActionState(importProductivity, IDLE);
  const [reading, startReading] = useTransition();
  const [note, setNote] = useState("");
  const [period, setPeriod] = useState<{ start: string; end: string } | null>(
    null,
  );
  const [costs, setCosts] = useState<number | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  // One upload, two optional destinations (decision of 11/11/2026).
  const [scope, setScope] = useState({
    oneDay: true,
    oneMonth: true,
    canBulletin: false,
  });
  const [toBook, setToBook] = useState(true);
  const [toBulletin, setToBulletin] = useState(false);

  const read = (form: HTMLFormElement | null) => {
    const file = (
      form?.elements.namedItem("relatorio") as HTMLInputElement | null
    )?.files?.[0];
    if (!file) {
      setNote("Escolha primeiro o PDF do relatório de produtividade.");
      return;
    }
    const data = new FormData();
    data.set("relatorio", file);
    startReading(async () => {
      const result = await readProductivity(data);
      if (!result.ok) {
        setNote(result.message);
        return;
      }
      setPeriod({ start: result.start, end: result.end });
      setCosts(result.costsCents);
      setScope({
        oneDay: result.oneDay,
        oneMonth: result.oneMonth,
        canBulletin: result.canBulletin,
      });
      setToBook(result.oneDay);
      setToBulletin(!result.oneDay && result.oneMonth && result.canBulletin);
      setRows(
        result.lines.map((l, i) => ({
          ...l,
          key: i,
          amount: money(l.amountCents),
          identification: "",
          explanation: "",
        })),
      );
      setNote(
        result.oneDay
          ? `Relatório do dia ${br(result.start)}: ${result.lines.length} linha(s) lida(s). Escolha abaixo o que fazer com ele.`
          : `Relatório de ${br(result.start)} a ${br(result.end)}. O livro recebe só o relatório de um dia (art. 190); este pode ir ao boletim mensal.`,
      );
    });
  };

  const lines = rows.map((r) => ({
    code: r.code,
    description: r.description,
    quantity: r.quantity,
    amountCents:
      Math.round(Number(r.amount.replace(/\./g, "").replace(",", ".")) * 100) ||
      0,
    fundsCents: r.fundsCents,
    issCents: r.issCents,
    specialty: r.specialty,
    identification: r.identification,
    explanation: r.explanation,
  }));
  const total = lines.reduce((s, l) => s + l.amountCents, 0);

  return (
    <form action={action} className={CARD}>
      <Feedback state={state} />
      <input type="hidden" name="linhas" value={JSON.stringify(lines)} />
      <input type="hidden" name="inicio" value={period?.start ?? ""} />
      <input type="hidden" name="fim" value={period?.end ?? ""} />
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[260px] flex-1">
          <label htmlFor="imp-file" className={LABEL}>
            Relatório de produtividade (PDF do sistema)
          </label>
          <input
            id="imp-file"
            name="relatorio"
            type="file"
            accept="application/pdf"
            className={FIELD}
          />
          <span className={HINT}>
            Do dia (De: 05/10 até 05/10), para o livro e o boletim; do mês, só
            para o boletim mensal. No livro, o arquivo fica guardado junto do
            lançamento.
          </span>
        </div>
        <button
          type="button"
          disabled={reading}
          onClick={(e) => read(e.currentTarget.form)}
          className="btn btn-admin-secondary btn-md"
        >
          {reading ? "Lendo..." : "Ler relatório"}
        </button>
      </div>
      {note && (
        <output className="text-[12.5px] font-semibold text-admin-primary">
          {note}
        </output>
      )}

      {period && (
        <fieldset className="flex flex-col gap-2 rounded-[12px] bg-admin-input-bg px-4 py-3.5 text-[13px] text-admin-text">
          <legend className="sr-only">O que fazer com este relatório</legend>
          <p className="font-bold text-admin-primary">
            O que fazer com este relatório
          </p>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              name="livro"
              checked={toBook}
              disabled={!scope.oneDay}
              onChange={(e) => setToBook(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              <strong>Lançar no Livro Diário Auxiliar</strong>: a receita do
              dia, por especialidade (art. 190).
              {!scope.oneDay && (
                <span className={HINT}>
                  Só o relatório de um dia: &quot;no dia da prática do ato&quot;
                  (art. 190).
                </span>
              )}
            </span>
          </label>
          {scope.canBulletin ? (
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                name="boletim"
                checked={toBulletin}
                disabled={!scope.oneMonth}
                onChange={(e) => setToBulletin(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                <strong>Enviar ao boletim mensal (Transparência)</strong>: abre
                o boletim do mês já preenchido para você conferir, assinar se
                quiser e publicar. Nada é publicado sem a sua confirmação.
                <span className={HINT}>
                  {scope.oneDay
                    ? "Com o relatório do dia, o boletim recebe a soma dos relatórios do mês lançados no livro."
                    : scope.oneMonth
                      ? "O boletim recebe os totais deste relatório."
                      : "O boletim é mensal: este relatório passa de um mês."}
                </span>
              </span>
            </label>
          ) : (
            <p className={HINT}>
              O boletim mensal precisa da permissão da Transparência.
            </p>
          )}
        </fieldset>
      )}

      {rows.length > 0 && toBook && (
        <>
          <div className="overflow-x-auto rounded-[12px] border border-admin-border">
            <table className="w-full min-w-[760px]">
              <thead className="bg-admin-input-bg text-left text-[11px] font-bold uppercase tracking-[0.05em] text-admin-muted">
                <tr>
                  <th className="px-2.5 py-2">Ato</th>
                  <th className="px-2.5 py-2">Especialidade</th>
                  <th className="px-2.5 py-2 text-right">Qtd.</th>
                  <th className="px-2.5 py-2">Receita (R$)</th>
                  <th className="px-2.5 py-2">
                    Nº do ato, livro e folha, ou protocolo
                  </th>
                  <th className="px-2.5 py-2">Explicação</th>
                  <th className="px-2.5 py-2">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.key}
                    className="border-t border-admin-border align-top text-[12.5px]"
                  >
                    <td className="px-2.5 py-1.5">
                      <input
                        aria-label="Descrição do ato"
                        value={r.description}
                        onChange={(e) =>
                          setRows((p) =>
                            p.map((x) =>
                              x.key === r.key
                                ? { ...x, description: e.target.value }
                                : x,
                            ),
                          )
                        }
                        className={SMALL}
                      />
                      <span className="text-[11px] text-admin-muted">
                        {r.code || "sem código"} · repasses R${" "}
                        {money(r.fundsCents)} · ISS R$ {money(r.issCents)}
                      </span>
                    </td>
                    <td className="px-2.5 py-1.5">
                      <input
                        aria-label="Especialidade"
                        list="book-specialties"
                        value={r.specialty}
                        onChange={(e) =>
                          setRows((p) =>
                            p.map((x) =>
                              x.key === r.key
                                ? { ...x, specialty: e.target.value }
                                : x,
                            ),
                          )
                        }
                        className={SMALL}
                      />
                    </td>
                    <td className="px-2.5 py-1.5 text-right">{r.quantity}</td>
                    <td className="px-2.5 py-1.5">
                      <input
                        aria-label="Receita"
                        value={r.amount}
                        onChange={(e) =>
                          setRows((p) =>
                            p.map((x) =>
                              x.key === r.key
                                ? { ...x, amount: e.target.value }
                                : x,
                            ),
                          )
                        }
                        className={`${SMALL} max-w-[120px]`}
                      />
                    </td>
                    <td className="px-2.5 py-1.5">
                      <input
                        aria-label="Nº do ato, livro e folha, ou protocolo"
                        value={r.identification}
                        placeholder="Ex.: Livro 12, fls. 30 a 32"
                        onChange={(e) =>
                          setRows((p) =>
                            p.map((x) =>
                              x.key === r.key
                                ? { ...x, identification: e.target.value }
                                : x,
                            ),
                          )
                        }
                        className={SMALL}
                      />
                    </td>
                    <td className="px-2.5 py-1.5">
                      <input
                        aria-label="Explicação"
                        value={r.explanation}
                        placeholder="Opcional"
                        onChange={(e) =>
                          setRows((p) =>
                            p.map((x) =>
                              x.key === r.key
                                ? { ...x, explanation: e.target.value }
                                : x,
                            ),
                          )
                        }
                        className={SMALL}
                      />
                    </td>
                    <td className="px-2.5 py-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setRows((p) => p.filter((x) => x.key !== r.key))
                        }
                        className="btn btn-admin-danger btn-sm"
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <datalist id="book-specialties">
              {specialties.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <p className="text-[12.5px] text-admin-text">
            Receita a lançar: <strong>R$ {money(total)}</strong> (emolumentos;
            os repasses aos fundos não são receita da serventia).
            {costs !== null && (
              <>
                {" "}
                O relatório informa custeio (despesas) de R$ {money(costs)}:
                lance as despesas uma a uma, com o comprovante, em "Lançar
                despesa".
              </>
            )}
          </p>
          <label className="flex items-start gap-2 text-[12.5px] text-admin-text">
            <input type="checkbox" name="substituir" className="mt-0.5" />
            Substituir as receitas já lidas desse período (as anteriores ficam
            guardadas como excluídas)
          </label>
        </>
      )}
      {period && (toBook || toBulletin) && (
        <Submit
          pending={pending}
          label={
            toBook && toBulletin
              ? "Lançar no livro e conferir o boletim"
              : toBook
                ? "Lançar no livro"
                : "Conferir o boletim"
          }
          busy="Enviando..."
        />
      )}
    </form>
  );
}

/* ---------------------------------------------------------------- entries */

export interface EntryInitial {
  id?: string;
  kind: "receita" | "despesa" | "deposito";
  date: string;
  specialty: string;
  category: string;
  actCode: string;
  description: string;
  quantity: number;
  amount: string;
  supplier: string;
  documentRef: string;
  fiscalDistinct: boolean;
  fiscalNote: string;
  explanation: string;
  attachmentName?: string | null;
}

export function EntryForm({
  initial,
  categories,
  specialties,
  today,
  interim = false,
}: {
  initial: EntryInitial;
  categories: { id: string; label: string }[];
  specialties: string[];
  today: string;
  /** An office run by an interim: its income tax is not an expense. */
  interim?: boolean;
}) {
  const [state, action, pending] = useActionState(saveEntry, IDLE);
  const [kind, setKind] = useState(initial.kind);
  const [v, setV] = useState(initial);
  const [fiscal, setFiscal] = useState(initial.fiscalDistinct);
  const [reading, startReading] = useTransition();
  const [note, setNote] = useState("");
  const set = (k: keyof EntryInitial) => (e: { target: { value: string } }) =>
    setV((x) => ({ ...x, [k]: e.target.value }));
  const warnings =
    kind === "despesa"
      ? expenseWarnings(
          { description: v.description, supplier: v.supplier, date: v.date },
          today,
          { isNew: !initial.id, interim },
        )
      : [];

  const read = (form: HTMLFormElement | null) => {
    const file = (
      form?.elements.namedItem("comprovante") as HTMLInputElement | null
    )?.files?.[0];
    if (!file) {
      setNote("Escolha primeiro o comprovante.");
      return;
    }
    const data = new FormData();
    data.set("comprovante", file);
    startReading(async () => {
      const result = await readReceipt(data);
      if (!result.ok) {
        setNote(result.message);
        return;
      }
      const r = result.reading;
      setV((x) => ({
        ...x,
        amount: r.amountCents !== null ? money(r.amountCents) : x.amount,
        date: r.paidOn && r.paidOn <= today ? r.paidOn : x.date,
        description: r.description || x.description,
        category: r.category ?? x.category,
      }));
      setNote("Comprovante lido: confira o valor, a data e a categoria.");
    });
  };

  return (
    <form
      // Sent by hand so a refused entry keeps every field as typed (a form
      // action resets the form, and a controlled select loses its choice).
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
      className={CARD}
    >
      <Feedback state={state} />
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <fieldset className="flex flex-wrap gap-4 text-[13px]">
        <legend className={LABEL}>Tipo</legend>
        {(interim || kind === "deposito"
          ? (["despesa", "receita", "deposito"] as const)
          : (["despesa", "receita"] as const)
        ).map((k) => (
          <label key={k} className="flex items-center gap-2">
            <input
              type="radio"
              name="tipo"
              value={k}
              checked={kind === k}
              onChange={() => setKind(k)}
            />
            {k === "despesa"
              ? "Despesa (art. 191-A)"
              : k === "receita"
                ? "Receita (art. 190)"
                : "Depósito do excedente do interino (art. 194, I)"}
          </label>
        ))}
      </fieldset>

      {kind !== "receita" && (
        <section className="flex flex-col gap-2 rounded-[12px] bg-admin-input-bg px-4 py-3.5">
          <p className="text-[13px] font-bold text-admin-primary">
            {kind === "despesa"
              ? "Comprovante (art. 191-A, caput e § 3º)"
              : "Comprovante do depósito"}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              name="comprovante"
              type="file"
              aria-label="Comprovante (PDF ou foto)"
              accept="application/pdf,image/*"
              className={`${FIELD} max-w-[420px]`}
            />
            <button
              type="button"
              disabled={reading}
              onClick={(e) => read(e.currentTarget.form)}
              className="btn btn-admin-secondary btn-md"
            >
              {reading ? "Lendo..." : "Ler comprovante"}
            </button>
          </div>
          <span className={HINT}>
            Do PDF (DAM, comprovante do banco) o sistema lê o valor, a data e o
            que foi pago.
            {initial.attachmentName
              ? ` Anexado: ${initial.attachmentName}.`
              : ""}
          </span>
          {note && (
            <output className="text-[12.5px] font-semibold text-admin-primary">
              {note}
            </output>
          )}
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label htmlFor="en-date" className={LABEL}>
            {kind === "despesa"
              ? "Data da despesa"
              : kind === "deposito"
                ? "Data do depósito (art. 194, I)"
                : "Dia da prática do ato (art. 190, § 1º)"}
          </label>
          <input
            id="en-date"
            name="data"
            type="date"
            required
            max={today}
            value={v.date}
            onChange={set("date")}
            className={FIELD}
          />
        </div>
        <div>
          <label htmlFor="en-amount" className={LABEL}>
            Valor (R$)
          </label>
          <input
            id="en-amount"
            name="valor"
            required
            inputMode="decimal"
            placeholder="0,00"
            value={v.amount}
            onChange={set("amount")}
            className={FIELD}
          />
        </div>
        {kind === "despesa" ? (
          <div>
            <label htmlFor="en-cat" className={LABEL}>
              Categoria (art. 191-A, § 1º)
            </label>
            <select
              id="en-cat"
              name="categoria"
              required
              value={v.category}
              onChange={set("category")}
              className={FIELD}
            >
              <option value="">Escolha</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        ) : kind === "deposito" ? (
          <div />
        ) : (
          <div>
            <label htmlFor="en-spec" className={LABEL}>
              Especialidade (art. 190)
            </label>
            <input
              id="en-spec"
              name="especialidade"
              required
              list="entry-specialties"
              value={v.specialty}
              onChange={set("specialty")}
              className={FIELD}
            />
            <datalist id="entry-specialties">
              {specialties.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
        )}
        <div className="md:col-span-2">
          <label htmlFor="en-desc" className={LABEL}>
            Discriminação
          </label>
          <input
            id="en-desc"
            name="descricao"
            required
            maxLength={500}
            value={v.description}
            onChange={set("description")}
            placeholder={
              kind === "despesa"
                ? "Ex.: Aluguel do imóvel da serventia, outubro"
                : kind === "deposito"
                  ? "Ex.: Excedente do 3º trimestre de 2026"
                  : "Ex.: Certidão de nascimento"
            }
            className={FIELD}
          />
        </div>
        {kind === "deposito" ? null : kind === "despesa" ? (
          <div>
            <label htmlFor="en-sup" className={LABEL}>
              Fornecedor / favorecido
            </label>
            <input
              id="en-sup"
              name="fornecedor"
              maxLength={160}
              value={v.supplier}
              onChange={set("supplier")}
              className={FIELD}
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="en-code" className={LABEL}>
                Código do ato
              </label>
              <input
                id="en-code"
                name="codigo"
                maxLength={20}
                value={v.actCode}
                onChange={set("actCode")}
                className={FIELD}
              />
            </div>
            <div>
              <label htmlFor="en-qty" className={LABEL}>
                Qtd.
              </label>
              <input
                id="en-qty"
                name="quantidade"
                type="number"
                min={1}
                value={v.quantity}
                onChange={(e) =>
                  setV((x) => ({ ...x, quantity: Number(e.target.value) || 1 }))
                }
                className={FIELD}
              />
            </div>
          </div>
        )}
        <div>
          <label htmlFor="en-doc" className={LABEL}>
            {kind === "despesa"
              ? "Documento (nota, recibo)"
              : kind === "deposito"
                ? "Conta em que foi depositado (art. 194, I)"
                : "Nº do ato, ou livro e folha, ou protocolo (art. 190)"}
          </label>
          <input
            id="en-doc"
            name="documento"
            required={kind === "deposito"}
            maxLength={160}
            value={v.documentRef}
            onChange={set("documentRef")}
            className={FIELD}
          />
        </div>
        <div className="md:col-span-2">
          <label htmlFor="en-exp" className={LABEL}>
            Explicação (vai no livro)
          </label>
          <input
            id="en-exp"
            name="explicacao"
            maxLength={5000}
            value={v.explanation}
            onChange={set("explanation")}
            placeholder="Ex.: retificação do lançamento de 05/10"
            className={FIELD}
          />
        </div>
      </div>

      {kind === "despesa" && (
        <>
          <p className="rounded-[10px] bg-admin-input-bg px-3.5 py-2.5 text-[12.5px] text-admin-muted">
            {PERSONAL_EXPENSE_RULE} {RECEIPTS_RULE}
          </p>
          {warnings.length > 0 && (
            <ul className="flex list-disc flex-col gap-1 rounded-[10px] bg-admin-warning-soft-bg py-2.5 pr-3.5 pl-8 text-[12.5px] text-admin-warning-text">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
          <label className="flex items-start gap-2.5 rounded-[10px] bg-admin-input-bg px-3.5 py-3 text-[13px] text-admin-text">
            <input
              type="checkbox"
              name="fiscal"
              checked={fiscal}
              onChange={(e) => setFiscal(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              <strong>Tratamento fiscal distinto</strong> (art. 193-A, § 2º):
              &quot;Quando as informações do Livro Diário Auxiliar forem
              utilizadas para fins tributários, deverão ser identificadas as
              despesas que recebam tratamento fiscal distinto daquele adotado
              para fins administrativos e correicionais.&quot;
            </span>
          </label>
          {fiscal && (
            <div>
              <label htmlFor="en-fiscal" className={LABEL}>
                Qual o tratamento fiscal
              </label>
              <input
                id="en-fiscal"
                name="fiscalNota"
                maxLength={1000}
                defaultValue={initial.fiscalNote}
                className={FIELD}
              />
            </div>
          )}
        </>
      )}
      <Submit
        pending={pending}
        label={initial.id ? "Salvar alterações" : "Lançar"}
        busy="Salvando..."
      />
    </form>
  );
}

export function RemoveEntryButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(removeEntry, IDLE);
  useEffect(() => {
    if (state.status === "saved") toast.success(state.message);
  }, [state]);
  return (
    <ConfirmAction
      action={action}
      pending={pending}
      error={state.status === "error" ? state.message : null}
      trigger="Excluir"
      question="Excluir este lançamento?"
      consequence="Ele sai do livro e das contas, mas continua guardado, com a justificativa. Para corrigir, prefira Editar."
      confirmLabel="Excluir"
      pendingLabel="Excluindo..."
    >
      <input type="hidden" name="id" value={id} />
    </ConfirmAction>
  );
}

/* ---------------------------------------------------------------- reports */

export function ReportForm({
  today,
  month,
  signers,
}: {
  today: string;
  month: string;
  signers: { name: string; title: string }[];
}) {
  const [state, action, pending] = useActionState(issueReport, IDLE);
  const [kind, setKind] = useState("mes");
  return (
    <form action={action} className={CARD}>
      <Feedback state={state} />
      <fieldset className="flex flex-wrap gap-4 text-[13px]">
        <legend className={LABEL}>Qual página?</legend>
        {[
          ["dia", "Do dia"],
          ["mes", "Do mês (apuração, art. 192)"],
          ["ano", "Balanço anual (art. 193)"],
          ["abertura", "Termo de abertura (art. 186)"],
          ["encerramento", "Termo de encerramento (art. 186)"],
        ].map(([value, label]) => (
          <label key={value} className="flex items-center gap-2">
            <input
              type="radio"
              name="tipo"
              value={value}
              checked={kind === value}
              onChange={() => setKind(value ?? "mes")}
            />
            {label}
          </label>
        ))}
      </fieldset>
      <div className="grid gap-4 md:grid-cols-4">
        {kind === "dia" && (
          <div>
            <label htmlFor="rp-day" className={LABEL}>
              Dia
            </label>
            <input
              id="rp-day"
              name="dia"
              type="date"
              required
              max={today}
              defaultValue={today}
              className={FIELD}
            />
          </div>
        )}
        {kind === "mes" && (
          <div>
            <label htmlFor="rp-month" className={LABEL}>
              Mês
            </label>
            <input
              id="rp-month"
              name="mes"
              type="month"
              required
              defaultValue={month}
              className={FIELD}
            />
          </div>
        )}
        {kind === "ano" && (
          <div>
            <label htmlFor="rp-year" className={LABEL}>
              Ano
            </label>
            <input
              id="rp-year"
              name="ano"
              type="number"
              min={2000}
              max={2100}
              required
              defaultValue={Number(month.slice(0, 4))}
              className={FIELD}
            />
          </div>
        )}
        <div>
          <label htmlFor="rp-date" className={LABEL}>
            {kind === "abertura" || kind === "encerramento"
              ? "Data do termo"
              : "Data da página"}
          </label>
          <input
            id="rp-date"
            name="data"
            type="date"
            required
            defaultValue={today}
            className={FIELD}
          />
        </div>
        <div
          hidden={kind === "abertura" || kind === "encerramento"}
          title="O termo é assinado pelo delegatário (art. 186)"
        >
          <label htmlFor="rp-signer" className={LABEL}>
            Quem assina
          </label>
          <select id="rp-signer" name="assina" className={FIELD}>
            {signers.length === 0 && (
              <option value="0">O Tabelião/Registrador</option>
            )}
            {signers.map((s, i) => (
              <option key={`${s.name}-${i}`} value={i}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="rp-notes" className={LABEL}>
            Observações
          </label>
          <input
            id="rp-notes"
            name="observacoes"
            maxLength={5000}
            className={FIELD}
          />
        </div>
      </div>
      {(kind === "abertura" || kind === "encerramento") && (
        <p className={HINT}>
          {kind === "abertura"
            ? '"O termo de abertura deverá conter o número do livro, o fim a que se destina, o número de folhas que contém, a declaração de que todas as suas folhas estão rubricadas e o fecho, com data, nome do delegatário e assinatura" (art. 186, parágrafo único). O número do livro e o de folhas vêm de Configurar.'
            : "O livro é encerrado pelo delegatário (art. 186). O termo diz o número do livro, as folhas e a última folha escriturada."}
        </p>
      )}
      <Submit pending={pending} label="Gerar página" busy="Gerando..." />
    </form>
  );
}

export function ReportEditForm({
  id,
  signers,
  initial,
}: {
  id: string;
  signers: { name: string; title: string }[];
  initial: { issuedOn: string; notes: string; signer: number };
}) {
  const [state, action, pending] = useActionState(editReport, IDLE);
  return (
    <form action={action} className={CARD}>
      <Feedback state={state} />
      <input type="hidden" name="id" value={id} />
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label htmlFor="re-date" className={LABEL}>
            Data da página
          </label>
          <input
            id="re-date"
            name="data"
            type="date"
            required
            defaultValue={initial.issuedOn}
            className={FIELD}
          />
        </div>
        <div>
          <label htmlFor="re-signer" className={LABEL}>
            Quem assina
          </label>
          <select
            id="re-signer"
            name="assina"
            defaultValue={initial.signer}
            className={FIELD}
          >
            {signers.length === 0 && (
              <option value="0">O Tabelião/Registrador</option>
            )}
            {signers.map((s, i) => (
              <option key={`${s.name}-${i}`} value={i}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="re-notes" className={LABEL}>
            Observações
          </label>
          <input
            id="re-notes"
            name="observacoes"
            maxLength={5000}
            defaultValue={initial.notes}
            className={FIELD}
          />
        </div>
      </div>
      <label className="flex items-start gap-2.5 rounded-[10px] bg-admin-input-bg px-3.5 py-3 text-[13px] text-admin-text">
        <input type="checkbox" name="atualizar" className="mt-0.5" />
        <span>
          <strong>Refazer com os lançamentos de agora</strong> (use depois de
          corrigir ou excluir um lançamento do período).
        </span>
      </label>
      <Submit pending={pending} label="Salvar alterações" busy="Salvando..." />
    </form>
  );
}

export function RemoveReportButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(removeReport, IDLE);
  return (
    <ConfirmAction
      action={action}
      pending={pending}
      error={state.status === "error" ? state.message : null}
      trigger="Excluir"
      question="Excluir esta página?"
      consequence="Ela sai da lista, mas continua guardada, com a justificativa. Os lançamentos não mudam."
      confirmLabel="Excluir"
      pendingLabel="Excluindo..."
    >
      <input type="hidden" name="id" value={id} />
    </ConfirmAction>
  );
}

/* --------------------------------------------------------------- settings */

export function SettingsForm({
  initial,
}: {
  initial: {
    specialties: { prefix: string; name: string }[];
    responsible: string;
    bookNumber: number;
    sheetCount: number;
    interim: boolean;
    ceilingCents: number;
    interimPeriod: "trimestral" | "mensal";
  };
}) {
  const [state, action, pending] = useActionState(saveSettings, IDLE);
  const [interim, setInterim] = useState(initial.interim);
  return (
    <form action={action} className={CARD}>
      <Feedback state={state} />
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="cf-book" className={LABEL}>
            Número do livro (art. 186)
          </label>
          <input
            id="cf-book"
            name="livro"
            type="number"
            min={1}
            max={9999}
            defaultValue={initial.bookNumber}
            className={`${FIELD} max-w-[160px]`}
          />
        </div>
        <div>
          <label htmlFor="cf-sheets" className={LABEL}>
            Número de folhas do livro (art. 186)
          </label>
          <input
            id="cf-sheets"
            name="folhas"
            type="number"
            min={0}
            max={100000}
            defaultValue={initial.sheetCount || ""}
            placeholder="Ex.: 200"
            className={`${FIELD} max-w-[160px]`}
          />
        </div>
        <span className={`${HINT} md:col-span-2`}>
          &quot;Os livros previstos neste Capítulo serão abertos, numerados,
          autenticados e encerrados pelo delegatário&quot; (art. 186). O termo
          de abertura sai com estes números; cada página gerada recebe as folhas
          seguintes do livro. Livro cheio: gere o termo de encerramento, passe
          para o número seguinte e gere o novo termo de abertura.
        </span>
      </div>
      <div>
        <label htmlFor="cf-spec" className={LABEL}>
          Especialidades pelo código do ato (uma por linha: código = nome)
        </label>
        <textarea
          id="cf-spec"
          name="especialidades"
          rows={6}
          defaultValue={initial.specialties
            .map((s) => `${s.prefix} = ${s.name}`)
            .join("\n")}
          className={`${FIELD} font-mono`}
        />
        <span className={HINT}>
          &quot;A receita será lançada no Livro Diário Auxiliar separadamente,
          por especialidade&quot; (art. 190). O sistema usa o começo do código
          do ato no relatório (ex.: 22 = Tabelionato de Notas, 23 = Registro
          Civil). Confira com a tabela de emolumentos do seu Estado.
        </span>
      </div>
      <div>
        <label htmlFor="cf-resp" className={LABEL}>
          Preposto que escritura (opcional)
        </label>
        <input
          id="cf-resp"
          name="responsavel"
          maxLength={160}
          defaultValue={initial.responsible}
          className={FIELD}
        />
        <span className={HINT}>
          &quot;A responsabilidade pela escrituração dos livros referidos neste
          Código de Normas é do delegatário, ainda quando escriturado pelo seu
          preposto&quot; (art. 187).
        </span>
      </div>
      <label className="flex items-start gap-2.5 rounded-[10px] bg-admin-input-bg px-3.5 py-3 text-[13px] text-admin-text">
        <input
          type="checkbox"
          name="interino"
          checked={interim}
          onChange={(e) => setInterim(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          <strong>Serventia vaga, respondida por interino</strong> (art. 194): a
          apuração mostra a renda líquida excedente a 90,25% dos subsídios de
          ministro do STF, e o livro aceita o lançamento do depósito, com a data
          e a conta (art. 194, I).
        </span>
      </label>
      {interim && (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="cf-teto" className={LABEL}>
              90,25% do subsídio mensal de ministro do STF (R$)
            </label>
            <input
              id="cf-teto"
              name="teto"
              inputMode="decimal"
              placeholder="0,00"
              defaultValue={
                initial.ceilingCents ? money(initial.ceilingCents) : ""
              }
              className={`${FIELD} max-w-[240px]`}
            />
            <span className={HINT}>
              Atualize quando o subsídio mudar: cada página guarda o valor da
              época.
            </span>
          </div>
          <fieldset>
            <legend className={LABEL}>Periodicidade (art. 194, VI)</legend>
            <label className="flex items-start gap-2 text-[13px]">
              <input
                type="radio"
                name="periodicidade"
                value="trimestral"
                defaultChecked={initial.interimPeriod !== "mensal"}
                className="mt-0.5"
              />
              Trimestral: &quot;considerando-se as receitas e as despesas do
              trimestre, não havendo lei estadual que estabeleça periodicidade
              diversa&quot;
            </label>
            <label className="mt-1.5 flex items-start gap-2 text-[13px]">
              <input
                type="radio"
                name="periodicidade"
                value="mensal"
                defaultChecked={initial.interimPeriod === "mensal"}
                className="mt-0.5"
              />
              Mensal: quando a norma do Estado fixar (no RN, recolhimento ao FDJ
              até o dia 10 do mês seguinte, Código de Normas da CGJ/RN, art. 27)
            </label>
          </fieldset>
        </div>
      )}
      <Submit
        pending={pending}
        label="Salvar configuração"
        busy="Salvando..."
      />
    </form>
  );
}
