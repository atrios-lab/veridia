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
import { Button, buttonVariants } from "../../../_ui/button.tsx";
import { Input } from "../../../_ui/input.tsx";
import { NativeSelect } from "../../../_ui/native-select.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../_ui/table.tsx";
import { Textarea } from "../../../_ui/textarea.tsx";
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
  saveBalanceOficio,
  saveEntry,
  saveSettings,
} from "./actions.ts";

const LABEL = "mb-1.5 block text-sm font-medium text-foreground";
const HINT = "mt-1 block text-xs text-muted-foreground";
const CARD = "flex flex-col gap-4 rounded-xl border bg-card p-5";
const TH = "h-9 px-2.5 text-xs font-medium text-muted-foreground";
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
      className="rounded-lg bg-destructive-soft px-3.5 py-2.5 text-sm font-semibold text-destructive"
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
    <Button type="submit" size="lg" disabled={pending} className="self-start">
      {pending ? busy : label}
    </Button>
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
          <Input
            id="imp-file"
            name="relatorio"
            type="file"
            accept="application/pdf"
          />
          <span className={HINT}>
            Do dia (De: 05/10 até 05/10), para o livro e o boletim; do mês, só
            para o boletim mensal. No livro, o arquivo fica guardado junto do
            lançamento.
          </span>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={reading}
          onClick={(e) => read(e.currentTarget.form)}
        >
          {reading ? "Lendo..." : "Ler relatório"}
        </Button>
      </div>
      {note && (
        <output className="text-sm font-semibold text-primary">{note}</output>
      )}

      {period && (
        <fieldset className="flex flex-col gap-2 rounded-lg bg-muted/50 px-4 py-3.5 text-sm text-foreground">
          <legend className="sr-only">O que fazer com este relatório</legend>
          <p className="font-semibold text-foreground">
            O que fazer com este relatório
          </p>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              name="livro"
              checked={toBook}
              disabled={!scope.oneDay}
              onChange={(e) => setToBook(e.target.checked)}
              className="checkbox-admin mt-0.5"
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
                className="checkbox-admin mt-0.5"
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
          <div className="rounded-lg border">
            <Table className="min-w-[760px]">
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className={TH}>Ato</TableHead>
                  <TableHead className={TH}>Especialidade</TableHead>
                  <TableHead className={`${TH} text-right`}>Qtd.</TableHead>
                  <TableHead className={TH}>Receita (R$)</TableHead>
                  <TableHead className={TH}>
                    Nº do ato, livro e folha, ou protocolo
                  </TableHead>
                  <TableHead className={TH}>Explicação</TableHead>
                  <TableHead className={TH}>
                    <span className="sr-only">Ações</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.key} className="align-top">
                    <TableCell className="px-2.5 py-1.5">
                      <Input
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
                        className="h-8"
                      />
                      <span className="text-xs whitespace-normal text-muted-foreground">
                        {r.code || "sem código"} · repasses R${" "}
                        {money(r.fundsCents)} · ISS R$ {money(r.issCents)}
                      </span>
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5">
                      <Input
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
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                      {r.quantity}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5">
                      <Input
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
                        className="h-8 max-w-[120px]"
                      />
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5">
                      <Input
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
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5">
                      <Input
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
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5">
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() =>
                          setRows((p) => p.filter((x) => x.key !== r.key))
                        }
                      >
                        Excluir
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <datalist id="book-specialties">
              {specialties.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <p className="text-sm text-foreground">
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
          <label className="flex items-start gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              name="substituir"
              className="checkbox-admin mt-0.5"
            />
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
      <fieldset className="flex flex-wrap gap-4 text-sm">
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
        <section className="flex flex-col gap-2 rounded-lg bg-muted/50 px-4 py-3.5">
          <p className="text-sm font-semibold text-foreground">
            {kind === "despesa"
              ? "Comprovante (art. 191-A, caput e § 3º)"
              : "Comprovante do depósito"}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              name="comprovante"
              type="file"
              aria-label="Comprovante (PDF ou foto)"
              accept="application/pdf,image/*"
              className="max-w-[420px]"
            />
            <Button
              type="button"
              variant="outline"
              disabled={reading}
              onClick={(e) => read(e.currentTarget.form)}
            >
              {reading ? "Lendo..." : "Ler comprovante"}
            </Button>
          </div>
          <span className={HINT}>
            Do PDF (DAM, comprovante do banco) o sistema lê o valor, a data e o
            que foi pago.
            {initial.attachmentName
              ? ` Anexado: ${initial.attachmentName}.`
              : ""}
          </span>
          {note && (
            <output className="text-sm font-semibold text-primary">
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
          <Input
            id="en-date"
            name="data"
            type="date"
            required
            max={today}
            value={v.date}
            onChange={set("date")}
          />
        </div>
        <div>
          <label htmlFor="en-amount" className={LABEL}>
            Valor (R$)
          </label>
          <Input
            id="en-amount"
            name="valor"
            required
            inputMode="decimal"
            placeholder="0,00"
            value={v.amount}
            onChange={set("amount")}
          />
        </div>
        {kind === "despesa" ? (
          <div>
            <label htmlFor="en-cat" className={LABEL}>
              Categoria (art. 191-A, § 1º)
            </label>
            <NativeSelect
              id="en-cat"
              name="categoria"
              required
              value={v.category}
              onChange={set("category")}
              className="w-full"
            >
              <option value="">Escolha</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </NativeSelect>
          </div>
        ) : kind === "deposito" ? (
          <div />
        ) : (
          <div>
            <label htmlFor="en-spec" className={LABEL}>
              Especialidade (art. 190)
            </label>
            <Input
              id="en-spec"
              name="especialidade"
              required
              list="entry-specialties"
              value={v.specialty}
              onChange={set("specialty")}
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
          <Input
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
          />
        </div>
        {kind === "deposito" ? null : kind === "despesa" ? (
          <div>
            <label htmlFor="en-sup" className={LABEL}>
              Fornecedor / favorecido
            </label>
            <Input
              id="en-sup"
              name="fornecedor"
              maxLength={160}
              value={v.supplier}
              onChange={set("supplier")}
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="en-code" className={LABEL}>
                Código do ato
              </label>
              <Input
                id="en-code"
                name="codigo"
                maxLength={20}
                value={v.actCode}
                onChange={set("actCode")}
              />
            </div>
            <div>
              <label htmlFor="en-qty" className={LABEL}>
                Qtd.
              </label>
              <Input
                id="en-qty"
                name="quantidade"
                type="number"
                min={1}
                value={v.quantity}
                onChange={(e) =>
                  setV((x) => ({ ...x, quantity: Number(e.target.value) || 1 }))
                }
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
          <Input
            id="en-doc"
            name="documento"
            required={kind === "deposito"}
            maxLength={160}
            value={v.documentRef}
            onChange={set("documentRef")}
          />
        </div>
        <div className="md:col-span-2">
          <label htmlFor="en-exp" className={LABEL}>
            Explicação (vai no livro)
          </label>
          <Input
            id="en-exp"
            name="explicacao"
            maxLength={5000}
            value={v.explanation}
            onChange={set("explanation")}
            placeholder="Ex.: retificação do lançamento de 05/10"
          />
        </div>
      </div>

      {kind === "despesa" && (
        <>
          <p className="rounded-lg bg-muted/50 px-3.5 py-2.5 text-xs text-muted-foreground">
            {PERSONAL_EXPENSE_RULE} {RECEIPTS_RULE}
          </p>
          {warnings.length > 0 && (
            <ul className="flex list-disc flex-col gap-1 rounded-lg bg-warning-soft py-2.5 pr-3.5 pl-8 text-xs text-warning-text">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
          <label className="flex items-start gap-2.5 rounded-lg bg-muted/50 px-3.5 py-3 text-sm text-foreground">
            <input
              type="checkbox"
              name="fiscal"
              checked={fiscal}
              onChange={(e) => setFiscal(e.target.checked)}
              className="checkbox-admin mt-0.5"
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
              <Input
                id="en-fiscal"
                name="fiscalNota"
                maxLength={1000}
                defaultValue={initial.fiscalNote}
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
      <fieldset className="flex flex-wrap gap-4 text-sm">
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
            <Input
              id="rp-day"
              name="dia"
              type="date"
              required
              max={today}
              defaultValue={today}
            />
          </div>
        )}
        {kind === "mes" && (
          <div>
            <label htmlFor="rp-month" className={LABEL}>
              Mês
            </label>
            <Input
              id="rp-month"
              name="mes"
              type="month"
              required
              defaultValue={month}
            />
          </div>
        )}
        {kind === "ano" && (
          <div>
            <label htmlFor="rp-year" className={LABEL}>
              Ano
            </label>
            <Input
              id="rp-year"
              name="ano"
              type="number"
              min={2000}
              max={2100}
              required
              defaultValue={Number(month.slice(0, 4))}
            />
          </div>
        )}
        <div>
          <label htmlFor="rp-date" className={LABEL}>
            {kind === "abertura" || kind === "encerramento"
              ? "Data do termo"
              : "Data da página"}
          </label>
          <Input
            id="rp-date"
            name="data"
            type="date"
            required
            defaultValue={today}
          />
        </div>
        <div
          hidden={kind === "abertura" || kind === "encerramento"}
          title="O termo é assinado pelo delegatário (art. 186)"
        >
          <label htmlFor="rp-signer" className={LABEL}>
            Quem assina
          </label>
          <NativeSelect id="rp-signer" name="assina" className="w-full">
            {signers.length === 0 && (
              <option value="0">O Tabelião/Registrador</option>
            )}
            {signers.map((s, i) => (
              <option key={`${s.name}-${i}`} value={i}>
                {s.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <label htmlFor="rp-notes" className={LABEL}>
            Observações
          </label>
          <Input id="rp-notes" name="observacoes" maxLength={5000} />
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
          <Input
            id="re-date"
            name="data"
            type="date"
            required
            defaultValue={initial.issuedOn}
          />
        </div>
        <div>
          <label htmlFor="re-signer" className={LABEL}>
            Quem assina
          </label>
          <NativeSelect
            id="re-signer"
            name="assina"
            defaultValue={initial.signer}
            className="w-full"
          >
            {signers.length === 0 && (
              <option value="0">O Tabelião/Registrador</option>
            )}
            {signers.map((s, i) => (
              <option key={`${s.name}-${i}`} value={i}>
                {s.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <label htmlFor="re-notes" className={LABEL}>
            Observações
          </label>
          <Input
            id="re-notes"
            name="observacoes"
            maxLength={5000}
            defaultValue={initial.notes}
          />
        </div>
      </div>
      <label className="flex items-start gap-2.5 rounded-lg bg-muted/50 px-3.5 py-3 text-sm text-foreground">
        <input
          type="checkbox"
          name="atualizar"
          className="checkbox-admin mt-0.5"
        />
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
          <Input
            id="cf-book"
            name="livro"
            type="number"
            min={1}
            max={9999}
            defaultValue={initial.bookNumber}
            className="max-w-[160px]"
          />
        </div>
        <div>
          <label htmlFor="cf-sheets" className={LABEL}>
            Número de folhas do livro (art. 186)
          </label>
          <Input
            id="cf-sheets"
            name="folhas"
            type="number"
            min={0}
            max={100000}
            defaultValue={initial.sheetCount || ""}
            placeholder="Ex.: 200"
            className="max-w-[160px]"
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
        <Textarea
          id="cf-spec"
          name="especialidades"
          rows={6}
          defaultValue={initial.specialties
            .map((s) => `${s.prefix} = ${s.name}`)
            .join("\n")}
          className="font-mono"
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
        <Input
          id="cf-resp"
          name="responsavel"
          maxLength={160}
          defaultValue={initial.responsible}
        />
        <span className={HINT}>
          &quot;A responsabilidade pela escrituração dos livros referidos neste
          Código de Normas é do delegatário, ainda quando escriturado pelo seu
          preposto&quot; (art. 187).
        </span>
      </div>
      <label className="flex items-start gap-2.5 rounded-lg bg-muted/50 px-3.5 py-3 text-sm text-foreground">
        <input
          type="checkbox"
          name="interino"
          checked={interim}
          onChange={(e) => setInterim(e.target.checked)}
          className="checkbox-admin mt-0.5"
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
            <Input
              id="cf-teto"
              name="teto"
              inputMode="decimal"
              placeholder="0,00"
              defaultValue={
                initial.ceilingCents ? money(initial.ceilingCents) : ""
              }
              className="max-w-[240px]"
            />
            <span className={HINT}>
              Atualize quando o subsídio mudar: cada página guarda o valor da
              época.
            </span>
          </div>
          <fieldset>
            <legend className={LABEL}>Periodicidade (art. 194, VI)</legend>
            <label className="flex items-start gap-2 text-sm">
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
            <label className="mt-1.5 flex items-start gap-2 text-sm">
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

/* ------------------------------------------------------------------ terms */

/** One term of the book: generated (open it) or a button to generate it. */
function TermBlock({
  kind,
  title,
  description,
  done,
  today,
  disabled,
  primary,
}: {
  kind: "abertura" | "encerramento";
  title: string;
  description: string;
  done: { href: string; date: string } | null;
  today: string;
  disabled: string | null;
  primary: boolean;
}) {
  const [state, action, pending] = useActionState(issueReport, IDLE);
  return (
    <div className="flex flex-col gap-3 rounded-lg bg-muted/50 p-4">
      <div>
        <p className="text-base font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      {done ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-success-soft px-3 py-1 text-xs font-semibold text-success-text">
            Gerado em {br(done.date)}
          </span>
          <a
            href={done.href}
            className={buttonVariants({ variant: "outline" })}
          >
            Abrir, assinar ou imprimir
          </a>
        </div>
      ) : (
        <form action={action} className="flex flex-wrap items-end gap-2">
          <Feedback state={state} />
          <input type="hidden" name="tipo" value={kind} />
          <div>
            <label htmlFor={`term-${kind}`} className={LABEL}>
              Data do termo
            </label>
            <Input
              id={`term-${kind}`}
              name="data"
              type="date"
              required
              defaultValue={today}
              className="max-w-[180px]"
            />
          </div>
          <Button
            type="submit"
            variant={primary ? "default" : "outline"}
            disabled={pending || Boolean(disabled)}
            title={disabled ?? undefined}
          >
            {pending ? "Gerando..." : `Gerar ${title.toLowerCase()}`}
          </Button>
          {disabled && <span className={HINT}>{disabled}</span>}
        </form>
      )}
    </div>
  );
}

/**
 * The book's opening and closing terms (CN art. 186), in plain sight
 * (decision of 12/11/2026): the clerk sees at once whether the book is
 * open and generates either term with one click.
 */
export function BookTermsPanel({
  bookNumber,
  sheetCount,
  usedSheets,
  opening,
  closing,
  today,
}: {
  bookNumber: number;
  sheetCount: number;
  usedSheets: number;
  opening: { href: string; date: string } | null;
  closing: { href: string; date: string } | null;
  today: string;
}) {
  const noSheets = sheetCount
    ? null
    : "Informe antes o número de folhas do livro em Configurar.";
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <TermBlock
        kind="abertura"
        title="Termo de abertura"
        description={`Primeira folha do livro nº ${bookNumber}: número do livro, finalidade, quantidade de folhas e declaração de que todas estão rubricadas.`}
        done={opening}
        today={today}
        disabled={noSheets}
        primary
      />
      <TermBlock
        kind="encerramento"
        title="Termo de encerramento"
        description={
          sheetCount
            ? `Última folha do livro nº ${bookNumber}. Folhas usadas: ${usedSheets} de ${sheetCount}. Gere quando as folhas acabarem.`
            : `Última folha do livro nº ${bookNumber}. Gere quando as folhas acabarem.`
        }
        done={closing}
        today={today}
        disabled={opening ? null : "Gere primeiro o termo de abertura."}
        primary={false}
      />
    </div>
  );
}

/* ---------------------------------------------------------------- ofício */

/**
 * The ofício that sends the year's balance to the Corregedoria (CGJ/RN art.
 * 62). The office numbers its ofícios in its own book, so the number is
 * theirs to type.
 */
export function BalanceOficioForm({
  id,
  initial,
}: {
  id: string;
  initial: { number: string; addressee: string; date: string };
}) {
  const [state, action, pending] = useActionState(saveBalanceOficio, IDLE);
  return (
    <form action={action} className={CARD}>
      <Feedback state={state} />
      <input type="hidden" name="id" value={id} />
      <div className="grid gap-4 md:grid-cols-[180px_180px_1fr]">
        <div>
          <label htmlFor="of-number" className={LABEL}>
            Número do ofício
          </label>
          <Input
            id="of-number"
            name="numero"
            required
            maxLength={40}
            placeholder="Ex.: 04/2026"
            defaultValue={initial.number}
          />
        </div>
        <div>
          <label htmlFor="of-date" className={LABEL}>
            Data do ofício
          </label>
          <Input
            id="of-date"
            name="data"
            type="date"
            required
            defaultValue={initial.date}
          />
        </div>
        <div>
          <label htmlFor="of-to" className={LABEL}>
            Destinatário (uma linha por linha do endereçamento)
          </label>
          <Textarea
            id="of-to"
            name="destinatario"
            required
            rows={3}
            maxLength={600}
            defaultValue={initial.addressee}
          />
        </div>
      </div>
      <p className={HINT}>
        O ofício sai na primeira página, seguido do balanço com as folhas do
        livro. O envio é feito pelos canais oficiais do Tribunal.
      </p>
      <Submit pending={pending} label="Salvar ofício" busy="Salvando..." />
    </form>
  );
}
