"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
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
      setRows(
        result.lines.map((l, i) => ({
          ...l,
          key: i,
          amount: money(l.amountCents),
          explanation: "",
        })),
      );
      setNote(
        result.start === result.end
          ? `Relatório do dia ${br(result.start)}: ${result.lines.length} linha(s) lida(s). Confira, corrija o que precisar e clique em Lançar.`
          : `Relatório de ${br(result.start)} a ${br(result.end)} (mês): ${result.lines.length} linha(s). Elas entram no último dia como consolidado; o ideal é anexar o relatório de cada dia (art. 190).`,
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
            Do dia (De: 05/10 até 05/10) ou do mês. O arquivo fica guardado
            junto do lançamento.
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

      {rows.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-[12px] border border-admin-border">
            <table className="w-full min-w-[760px]">
              <thead className="bg-admin-input-bg text-left text-[11px] font-bold uppercase tracking-[0.05em] text-admin-muted">
                <tr>
                  <th className="px-2.5 py-2">Ato</th>
                  <th className="px-2.5 py-2">Especialidade</th>
                  <th className="px-2.5 py-2 text-right">Qtd.</th>
                  <th className="px-2.5 py-2">Receita (R$)</th>
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
          <Submit
            pending={pending}
            label="Lançar no livro"
            busy="Lançando..."
          />
        </>
      )}
    </form>
  );
}

/* ---------------------------------------------------------------- entries */

export interface EntryInitial {
  id?: string;
  kind: "receita" | "despesa";
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
}: {
  initial: EntryInitial;
  categories: { id: string; label: string }[];
  specialties: string[];
  today: string;
}) {
  const [state, action, pending] = useActionState(saveEntry, IDLE);
  const [kind, setKind] = useState(initial.kind);
  const [v, setV] = useState(initial);
  const [fiscal, setFiscal] = useState(initial.fiscalDistinct);
  const [reading, startReading] = useTransition();
  const [note, setNote] = useState("");
  const set = (k: keyof EntryInitial) => (e: { target: { value: string } }) =>
    setV((x) => ({ ...x, [k]: e.target.value }));
  const personal =
    /\b(pessoal|particular|fam[ií]lia|resid[êe]ncia|supermercado|farm[áa]cia|f[ée]rias)\b/i.test(
      `${v.description} ${v.supplier}`,
    );

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
    <form action={action} className={CARD}>
      <Feedback state={state} />
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <fieldset className="flex flex-wrap gap-4 text-[13px]">
        <legend className={LABEL}>Tipo</legend>
        {(["despesa", "receita"] as const).map((k) => (
          <label key={k} className="flex items-center gap-2">
            <input
              type="radio"
              name="tipo"
              value={k}
              checked={kind === k}
              onChange={() => setKind(k)}
            />
            {k === "despesa" ? "Despesa" : "Receita avulsa (fora do relatório)"}
          </label>
        ))}
      </fieldset>

      {kind === "despesa" && (
        <section className="flex flex-col gap-2 rounded-[12px] bg-admin-input-bg px-4 py-3.5">
          <p className="text-[13px] font-bold text-admin-primary">
            Comprovante (art. 191-A, § 3º: guardado 5 anos)
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
            {kind === "despesa" ? "Data do pagamento" : "Data do ato"}
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
        ) : (
          <div>
            <label htmlFor="en-spec" className={LABEL}>
              Especialidade
            </label>
            <input
              id="en-spec"
              name="especialidade"
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
                : "Ex.: Certidão, livro 3, folha 20"
            }
            className={FIELD}
          />
        </div>
        {kind === "despesa" ? (
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
            Documento (nota, recibo, protocolo)
          </label>
          <input
            id="en-doc"
            name="documento"
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
          {personal && (
            <p className="rounded-[10px] bg-admin-warning-soft-bg px-3.5 py-2.5 text-[12.5px] text-admin-warning-text">
              Atenção: despesa de natureza pessoal ou estranha ao serviço não
              pode ser lançada (art. 191-A, § 2º). Se for do serviço, explique.
            </p>
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
              <strong>Tratamento fiscal distinto</strong> (art. 193-A, § 2º): a
              despesa vale para o livro, mas tem outro tratamento no imposto de
              renda (ex.: não dedutível no carnê-leão).
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
          ["mes", "Do mês inteiro (apuração)"],
          ["ano", "Balanço anual"],
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
            Data da página
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
        <div>
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
  };
}) {
  const [state, action, pending] = useActionState(saveSettings, IDLE);
  return (
    <form action={action} className={CARD}>
      <Feedback state={state} />
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
          O art. 190 pede a receita separada por especialidade. O sistema usa o
          começo do código do ato no relatório (ex.: 22 = Tabelionato de Notas,
          23 = Registro Civil). Confira com a tabela de emolumentos do seu
          Estado.
        </span>
      </div>
      <div>
        <label htmlFor="cf-resp" className={LABEL}>
          Responsável pela escrituração (opcional)
        </label>
        <input
          id="cf-resp"
          name="responsavel"
          maxLength={160}
          defaultValue={initial.responsible}
          className={FIELD}
        />
        <span className={HINT}>
          A escrituração é de responsabilidade do titular, mesmo feita por
          preposto. Quem assina as páginas vem de Configurações › Quem assina.
        </span>
      </div>
      <Submit
        pending={pending}
        label="Salvar configuração"
        busy="Salvando..."
      />
    </form>
  );
}
