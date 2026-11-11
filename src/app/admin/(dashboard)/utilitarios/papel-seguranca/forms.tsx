"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "../../../_components/confirm-action.tsx";
import {
  addLot,
  addMovement,
  editLot,
  editMovement,
  editReport,
  issueReport,
  type PaperFormState,
  recordSent,
  removeReport,
  saveSettings,
  voidLot,
  voidMovement,
} from "./actions.ts";

const FIELD =
  "w-full rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3.5 py-2.5 text-[13.5px] text-admin-text outline-none focus:border-admin-primary-soft";
const LABEL = "mb-1.5 block text-[12.5px] font-semibold text-admin-text";
const HINT = "mt-1 block text-[11.5px] text-admin-muted";
const CARD =
  "flex flex-col gap-4 rounded-[14px] border border-admin-border bg-admin-card px-5 py-5";
const IDLE: PaperFormState = { status: "idle" };

function Feedback({ state }: { state: PaperFormState }) {
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

/** "AB 000123" -> its number, to count the sheets as they are typed. */
function numberOf(text: string): number | null {
  const match = text.trim().match(/(\d{1,12})$/);
  return match ? Number(match[1]) : null;
}

/* ------------------------------------------------------------------ lots */

export interface LotEdit {
  id: string;
  kind: string;
  kindLabel: string;
  first: string;
  last: string;
  receivedOn: string;
  opening: boolean;
  supplier: string;
  invoice: string;
  requisition: string;
  notes: string;
}

/** Registers a lot, or (with `edit`) changes one, numbering included. */
export function LotForm({
  kinds,
  today,
  edit,
}: {
  kinds: { value: string; label: string }[];
  today: string;
  edit?: LotEdit;
}) {
  const [state, action, pending] = useActionState(
    edit ? editLot : addLot,
    IDLE,
  );
  const [kind, setKind] = useState(edit?.kind ?? kinds[0]?.value ?? "");
  const [first, setFirst] = useState(edit?.first ?? "");
  const [last, setLast] = useState(edit?.last ?? "");
  const [opening, setOpening] = useState(edit?.opening ?? false);
  const a = numberOf(first);
  const b = numberOf(last);
  const count = a !== null && b !== null && b >= a ? b - a + 1 : null;

  return (
    <form action={action} className={CARD}>
      <Feedback state={state} />
      {edit && <input type="hidden" name="id" value={edit.id} />}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="lot-kind" className={LABEL}>
            Tipo de papel
          </label>
          <select
            id="lot-kind"
            name="tipo"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className={FIELD}
          >
            {kinds.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
        {kind === "outro" && (
          <div>
            <label htmlFor="lot-name" className={LABEL}>
              Que papel é este?
            </label>
            <input
              id="lot-name"
              name="nome"
              required
              defaultValue={edit?.kindLabel}
              maxLength={120}
              placeholder="Ex.: folha de procuração"
              className={FIELD}
            />
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label htmlFor="lot-first" className={LABEL}>
            Primeira folha
          </label>
          <input
            id="lot-first"
            name="primeira"
            required
            value={first}
            onChange={(e) => setFirst(e.target.value)}
            placeholder="AB 000001"
            className={`${FIELD} font-mono`}
          />
          <span className={HINT}>
            Como está impressa, com as letras da série.
          </span>
        </div>
        <div>
          <label htmlFor="lot-last" className={LABEL}>
            Última folha
          </label>
          <input
            id="lot-last"
            name="ultima"
            required
            value={last}
            onChange={(e) => setLast(e.target.value)}
            placeholder="AB 000500"
            className={`${FIELD} font-mono`}
          />
          <span className={HINT}>
            {count ? (
              <strong className="text-admin-primary">
                {count.toLocaleString("pt-BR")} folha{count === 1 ? "" : "s"}
              </strong>
            ) : (
              "A quantidade aparece aqui."
            )}
          </span>
        </div>
        <div>
          <label htmlFor="lot-date" className={LABEL}>
            {opening ? "Contado em" : "Recebido em"}
          </label>
          <input
            id="lot-date"
            name="recebido"
            type="date"
            required
            max={today}
            defaultValue={edit?.receivedOn ?? today}
            className={FIELD}
          />
        </div>
      </div>

      <label className="flex items-start gap-2.5 rounded-[10px] bg-admin-input-bg px-3.5 py-3 text-[13px] text-admin-text">
        <input
          type="checkbox"
          name="anterior"
          checked={opening}
          onChange={(e) => setOpening(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          <strong>Estoque que a serventia já tinha</strong> (folhas compradas
          antes deste controle). Entram como estoque inicial, não como recebidas
          no trimestre. Cadastre só as folhas que ainda estão na gaveta.
        </span>
      </label>

      <details
        open={Boolean(edit)}
        className="rounded-[10px] border border-admin-border px-4 py-3"
      >
        <summary className="cursor-pointer text-[13px] font-semibold text-admin-primary">
          Nota fiscal, gráfica e requisição (opcional)
        </summary>
        <p className="mt-2 text-[12px] text-admin-muted">
          Nada aqui é obrigatório: há lotes comprados há anos cuja nota não está
          mais na serventia. Dá para completar depois, no lote.
        </p>
        <LotDetailsFields initial={edit} />
      </details>

      <Submit
        pending={pending}
        label={edit ? "Salvar alterações" : "Cadastrar lote"}
        busy={edit ? "Salvando..." : "Cadastrando..."}
      />
    </form>
  );
}

function LotDetailsFields({
  initial,
}: {
  initial?: {
    supplier: string;
    invoice: string;
    requisition: string;
    notes: string;
  };
}) {
  return (
    <div className="mt-3 grid gap-4 md:grid-cols-2">
      <div>
        <label htmlFor="lot-supplier" className={LABEL}>
          Gráfica (onde comprou)
        </label>
        <input
          id="lot-supplier"
          name="grafica"
          maxLength={160}
          defaultValue={initial?.supplier}
          placeholder="Nome da gráfica ou fornecedor"
          className={FIELD}
        />
      </div>
      <div>
        <label htmlFor="lot-invoice" className={LABEL}>
          Nº da nota fiscal
        </label>
        <input
          id="lot-invoice"
          name="nota"
          maxLength={80}
          defaultValue={initial?.invoice}
          className={FIELD}
        />
      </div>
      <div>
        <label htmlFor="lot-requisition" className={LABEL}>
          Requisição ou autorização da Corregedoria
        </label>
        <input
          id="lot-requisition"
          name="requisicao"
          maxLength={120}
          defaultValue={initial?.requisition}
          placeholder="Nº do ofício, pedido ou protocolo"
          className={FIELD}
        />
      </div>
      <div>
        <label htmlFor="lot-file" className={LABEL}>
          Arquivo da nota (PDF ou foto)
        </label>
        <input
          id="lot-file"
          name="arquivo"
          type="file"
          accept="application/pdf,image/*"
          className={FIELD}
        />
      </div>
      <div className="md:col-span-2">
        <label htmlFor="lot-notes" className={LABEL}>
          Observações
        </label>
        <textarea
          id="lot-notes"
          name="observacoes"
          rows={2}
          maxLength={5000}
          defaultValue={initial?.notes}
          className={FIELD}
        />
      </div>
    </div>
  );
}

export function VoidLotButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(voidLot, IDLE);
  return (
    <ConfirmAction
      action={action}
      pending={pending}
      error={state.status === "error" ? state.message : null}
      trigger="Excluir lote"
      question="Excluir este lote?"
      consequence="Ele sai do estoque e da lista, mas continua guardado no classificador, com a justificativa. Para corrigir um dado, prefira Editar."
      confirmLabel="Excluir"
      pendingLabel="Excluindo..."
    >
      <input type="hidden" name="id" value={id} />
    </ConfirmAction>
  );
}

/* ------------------------------------------------------------- movements */

export interface LotChoice {
  id: string;
  label: string;
  remaining: number;
  next: string | null;
}

const TYPES: { value: string; label: string; hint: string }[] = [
  {
    value: "utilizado",
    label: "Utilizadas em atos",
    hint: "Baixa do estoque das folhas usadas.",
  },
  {
    value: "inutilizado",
    label: "Inutilizadas",
    hint: "Erro de impressão ou de lavratura: a folha foi cancelada.",
  },
  {
    value: "avariado",
    label: "Avariadas",
    hint: "Danificadas (rasgadas, molhadas). Comunicadas no fim do mês.",
  },
  {
    value: "extraviado",
    label: "Extraviadas",
    hint: "Perdidas. Comunicadas à Corregedoria no fim do mês.",
  },
  {
    value: "subtraido",
    label: "Subtraídas",
    hint: "Furto ou roubo. Comunicadas no fim do mês, com o B.O.",
  },
];

export function MovementForm({
  lots,
  today,
  initialType = "utilizado",
}: {
  lots: LotChoice[];
  today: string;
  initialType?: string;
}) {
  const [state, action, pending] = useActionState(addMovement, IDLE);
  const [type, setType] = useState(initialType);
  const [mode, setMode] = useState(
    initialType === "utilizado" ? "ate" : "numeracao",
  );
  const [lotId, setLotId] = useState(lots[0]?.id ?? "");
  const lot = lots.find((l) => l.id === lotId);
  const loss = type === "extraviado" || type === "subtraido";

  if (lots.length === 0) {
    return (
      <p className="rounded-[12px] bg-admin-input-bg px-4 py-3 text-[13px] text-admin-text">
        Cadastre primeiro um lote: os lançamentos baixam folhas de um lote.
      </p>
    );
  }

  return (
    <form action={action} className={CARD}>
      <Feedback state={state} />
      <fieldset>
        <legend className={LABEL}>O que aconteceu com as folhas?</legend>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {TYPES.map((t) => (
            <label
              key={t.value}
              className={`flex cursor-pointer flex-col gap-1 rounded-[10px] border px-3 py-2.5 text-[12.5px] ${
                type === t.value
                  ? "border-admin-primary bg-admin-success-bg"
                  : "border-admin-border bg-admin-card"
              }`}
            >
              <span className="flex items-center gap-2 font-bold text-admin-primary">
                <input
                  type="radio"
                  name="tipo"
                  value={t.value}
                  checked={type === t.value}
                  onChange={() => {
                    setType(t.value);
                    setMode(
                      t.value === "utilizado" ? "quantidade" : "numeracao",
                    );
                  }}
                />
                {t.label}
              </span>
              <span className="text-admin-muted">{t.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
        <div>
          <label htmlFor="mv-lot" className={LABEL}>
            Lote
          </label>
          <select
            id="mv-lot"
            name="lote"
            value={lotId}
            onChange={(e) => setLotId(e.target.value)}
            className={FIELD}
          >
            {lots.map((l) => (
              <option key={l.id} value={l.id} disabled={l.remaining === 0}>
                {l.label} · restam {l.remaining.toLocaleString("pt-BR")}
              </option>
            ))}
          </select>
          {lot?.next && (
            <span className={HINT}>
              Próxima folha livre:{" "}
              <strong className="font-mono">{lot.next}</strong>
            </span>
          )}
        </div>
        <div>
          <label htmlFor="mv-date" className={LABEL}>
            Data
          </label>
          <input
            id="mv-date"
            name="data"
            type="date"
            required
            max={today}
            defaultValue={today}
            className={FIELD}
          />
        </div>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className={LABEL}>Quais folhas?</legend>
        <div className="flex flex-wrap gap-4 text-[13px]">
          {type === "utilizado" && (
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="modo"
                value="ate"
                checked={mode === "ate"}
                onChange={() => setMode("ate")}
              />
              <strong>Usei até a folha nº</strong> (fechamento do mês)
            </label>
          )}
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="modo"
              value="quantidade"
              checked={mode === "quantidade"}
              onChange={() => setMode("quantidade")}
            />
            Quantidade, a partir da próxima folha livre
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="modo"
              value="numeracao"
              checked={mode === "numeracao"}
              onChange={() => setMode("numeracao")}
            />
            Pela numeração
          </label>
        </div>
        {mode === "ate" ? (
          <div className="max-w-[420px]">
            <label htmlFor="mv-upto" className={LABEL}>
              Última folha usada
            </label>
            <input
              id="mv-upto"
              name="ate"
              required
              placeholder={lot?.next ?? "AB 000350"}
              className={`${FIELD} font-mono`}
            />
            <span className={HINT}>
              Olhe a primeira folha em branco na gaveta: a anterior a ela é a
              última usada. O sistema baixa todas as folhas livres de{" "}
              {lot?.next ? (
                <strong className="font-mono">{lot.next}</strong>
              ) : (
                "a próxima livre"
              )}{" "}
              até ela, pulando as inutilizadas, avariadas e extraviadas já
              lançadas. Use a data do último dia do mês.
            </span>
          </div>
        ) : mode === "quantidade" ? (
          <div className="max-w-[220px]">
            <label htmlFor="mv-qty" className={LABEL}>
              Quantas folhas
            </label>
            <input
              id="mv-qty"
              name="quantidade"
              type="number"
              min={1}
              required
              inputMode="numeric"
              className={FIELD}
            />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="mv-first" className={LABEL}>
                Folha (ou primeira folha)
              </label>
              <input
                id="mv-first"
                name="primeira"
                required
                placeholder={lot?.next ?? "AB 000001"}
                className={`${FIELD} font-mono`}
              />
            </div>
            <div>
              <label htmlFor="mv-last" className={LABEL}>
                Última folha (se for mais de uma)
              </label>
              <input
                id="mv-last"
                name="ultima"
                placeholder="Em branco: só uma folha"
                className={`${FIELD} font-mono`}
              />
            </div>
          </div>
        )}
      </fieldset>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="mv-ref" className={LABEL}>
            {loss
              ? "Como aconteceu (e o boletim de ocorrência)"
              : type === "utilizado"
                ? "Atos (livro e folhas), opcional"
                : "Motivo, opcional"}
          </label>
          <input
            id="mv-ref"
            name="referencia"
            maxLength={300}
            required={loss}
            placeholder={
              loss
                ? "Ex.: extraviada no balcão; B.O. nº 123/2026"
                : type === "utilizado"
                  ? "Ex.: Livro 12, fls. 34 a 40"
                  : "Ex.: erro de impressão"
            }
            className={FIELD}
          />
          {loss && (
            <span className={HINT}>
              Vai no ofício à Corregedoria, com a numeração das folhas.
            </span>
          )}
        </div>
        <div>
          <label htmlFor="mv-notes" className={LABEL}>
            Observações
          </label>
          <input
            id="mv-notes"
            name="observacoes"
            maxLength={5000}
            className={FIELD}
          />
        </div>
      </div>

      <Submit pending={pending} label="Lançar" busy="Lançando..." />
    </form>
  );
}

export function VoidMovementButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(voidMovement, IDLE);
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
      consequence="As folhas voltam ao estoque. O lançamento sai da lista, mas continua guardado no classificador, com a justificativa. Para corrigir, prefira Editar."
      confirmLabel="Excluir"
      pendingLabel="Excluindo..."
    >
      <input type="hidden" name="id" value={id} />
    </ConfirmAction>
  );
}

/* --------------------------------------------------------------- reports */

const MODELS: { value: string; label: string; hint: string }[] = [
  {
    value: "prestacao",
    label: "Prestação de contas trimestral",
    hint: "Ofício à Corregedoria com o demonstrativo (estoque inicial, recebidas, utilizadas, inutilizadas, avariadas, extraviadas, estoque final) e o anexo com a numeração.",
  },
  {
    value: "extravio",
    label: "Comunicação de extravio, subtração ou avaria",
    hint: "Ofício do fim do mês com a numeração das folhas, para publicação no DJe.",
  },
  {
    value: "relatorio",
    label: "Relatório do classificador",
    hint: "Para o arquivo da serventia e para a correição: lotes, notas, gráficas, lançamentos e estoque de qualquer período.",
  },
];

export function ReportForm({
  initial,
  quarters,
  months,
  signers,
  today,
}: {
  initial: { kind: string; quarter: string; month: string };
  quarters: { value: string; label: string }[];
  months: { value: string; label: string }[];
  signers: { name: string; title: string }[];
  today: string;
}) {
  const [state, action, pending] = useActionState(issueReport, IDLE);
  const [kind, setKind] = useState(initial.kind);
  return (
    <form action={action} className={CARD}>
      <Feedback state={state} />
      <fieldset>
        <legend className={LABEL}>Qual documento?</legend>
        <div className="grid gap-2 md:grid-cols-3">
          {MODELS.map((m) => (
            <label
              key={m.value}
              className={`flex cursor-pointer flex-col gap-1 rounded-[10px] border px-3.5 py-3 text-[12.5px] ${
                kind === m.value
                  ? "border-admin-primary bg-admin-success-bg"
                  : "border-admin-border bg-admin-card"
              }`}
            >
              <span className="flex items-center gap-2 font-bold text-admin-primary">
                <input
                  type="radio"
                  name="tipo"
                  value={m.value}
                  checked={kind === m.value}
                  onChange={() => setKind(m.value)}
                />
                {m.label}
              </span>
              <span className="text-admin-muted">{m.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 md:grid-cols-3">
        {kind === "prestacao" && (
          <div>
            <label htmlFor="rp-quarter" className={LABEL}>
              Trimestre
            </label>
            <select
              id="rp-quarter"
              name="trimestre"
              defaultValue={initial.quarter}
              className={FIELD}
            >
              {quarters.map((q) => (
                <option key={q.value} value={q.value}>
                  {q.label}
                </option>
              ))}
            </select>
          </div>
        )}
        {kind === "extravio" && (
          <div>
            <label htmlFor="rp-month" className={LABEL}>
              Mês das ocorrências
            </label>
            <select
              id="rp-month"
              name="mes"
              defaultValue={initial.month}
              className={FIELD}
            >
              {months.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        )}
        {kind === "relatorio" && (
          <>
            <div>
              <label htmlFor="rp-start" className={LABEL}>
                De
              </label>
              <input
                id="rp-start"
                name="inicio"
                type="date"
                required
                defaultValue={`${today.slice(0, 4)}-01-01`}
                className={FIELD}
              />
            </div>
            <div>
              <label htmlFor="rp-end" className={LABEL}>
                Até
              </label>
              <input
                id="rp-end"
                name="fim"
                type="date"
                required
                defaultValue={today}
                className={FIELD}
              />
            </div>
          </>
        )}
        <div>
          <label htmlFor="rp-date" className={LABEL}>
            Data do documento
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
      </div>

      <div className="grid gap-4 md:grid-cols-2">
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
                {s.title ? `, ${s.title}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="rp-notes" className={LABEL}>
            Observações (vão no documento)
          </label>
          <input
            id="rp-notes"
            name="observacoes"
            maxLength={5000}
            className={FIELD}
          />
        </div>
      </div>

      <p className="text-[12px] text-admin-muted">
        O documento sai com o que está lançado agora e fica guardado assim, com
        número, mesmo que algo seja corrigido depois. Na tela seguinte: assinar
        digitalmente, imprimir, baixar a planilha e anotar o envio.
      </p>
      <Submit pending={pending} label="Gerar documento" busy="Gerando..." />
    </form>
  );
}

export function SentForm({
  id,
  sentOn,
  reference,
  today,
}: {
  id: string;
  sentOn: string;
  reference: string;
  today: string;
}) {
  const [state, action, pending] = useActionState(recordSent, IDLE);
  return (
    <form action={action} className={CARD}>
      <Feedback state={state} />
      <input type="hidden" name="id" value={id} />
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="snt-date" className={LABEL}>
            Enviado à Corregedoria em
          </label>
          <input
            id="snt-date"
            name="enviado"
            type="date"
            max={today}
            defaultValue={sentOn}
            className={FIELD}
          />
        </div>
        <div>
          <label htmlFor="snt-ref" className={LABEL}>
            Protocolo, malote digital ou e-mail
          </label>
          <input
            id="snt-ref"
            name="protocolo"
            maxLength={160}
            defaultValue={reference}
            placeholder="Ex.: Malote Digital nº 2026.0001234"
            className={FIELD}
          />
        </div>
      </div>
      <Submit pending={pending} label="Salvar envio" busy="Salvando..." />
    </form>
  );
}

/* -------------------------------------------------------------- settings */

export function SettingsForm({
  initial,
}: {
  initial: {
    authority: string;
    headName: string;
    headTitle: string;
    address: string;
    email: string;
    stateRule: string;
    deadlineDay: number | null;
    lowStock: number;
  };
}) {
  const [state, action, pending] = useActionState(saveSettings, IDLE);
  return (
    <form action={action} className={CARD}>
      <Feedback state={state} />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label htmlFor="cfg-authority" className={LABEL}>
            Órgão destinatário
          </label>
          <input
            id="cfg-authority"
            name="orgao"
            maxLength={200}
            defaultValue={initial.authority}
            className={FIELD}
          />
        </div>
        <div>
          <label htmlFor="cfg-name" className={LABEL}>
            Nome do(a) Corregedor(a)-Geral (opcional)
          </label>
          <input
            id="cfg-name"
            name="nome"
            maxLength={160}
            defaultValue={initial.headName}
            className={FIELD}
          />
        </div>
        <div>
          <label htmlFor="cfg-title" className={LABEL}>
            Tratamento e cargo
          </label>
          <input
            id="cfg-title"
            name="cargo"
            maxLength={160}
            defaultValue={initial.headTitle}
            className={FIELD}
          />
        </div>
        <div>
          <label htmlFor="cfg-address" className={LABEL}>
            Endereço (opcional)
          </label>
          <input
            id="cfg-address"
            name="endereco"
            maxLength={300}
            defaultValue={initial.address}
            className={FIELD}
          />
        </div>
        <div>
          <label htmlFor="cfg-email" className={LABEL}>
            E-mail ou malote (opcional)
          </label>
          <input
            id="cfg-email"
            name="email"
            maxLength={160}
            defaultValue={initial.email}
            className={FIELD}
          />
        </div>
        <div className="md:col-span-2">
          <label htmlFor="cfg-rule" className={LABEL}>
            Norma do Estado sobre o papel de segurança
          </label>
          <input
            id="cfg-rule"
            name="norma"
            maxLength={400}
            defaultValue={initial.stateRule}
            className={FIELD}
          />
          <span className={HINT}>
            Citada nos ofícios com os artigos (art. 59 na comunicação, art. 60
            na prestação de contas). Em branco, os ofícios citam as normas da
            Corregedoria em termos gerais.
          </span>
        </div>
        <div>
          <label htmlFor="cfg-deadline" className={LABEL}>
            Prazo da prestação (dia do mês seguinte ao trimestre)
          </label>
          <input
            id="cfg-deadline"
            name="prazo"
            type="number"
            min={1}
            max={31}
            defaultValue={initial.deadlineDay ?? ""}
            placeholder="Em branco: sem prazo fixo"
            className={FIELD}
          />
          <span className={HINT}>
            Se a Corregedoria fixou um dia, ele aparece no lembrete.
          </span>
        </div>
        <div>
          <label htmlFor="cfg-low" className={LABEL}>
            Avisar quando restarem (folhas de cada tipo)
          </label>
          <input
            id="cfg-low"
            name="alerta"
            type="number"
            min={0}
            max={100000}
            defaultValue={initial.lowStock}
            className={FIELD}
          />
          <span className={HINT}>
            Padrão: 200. O aviso leva ao pedido de um novo lote. Zero desliga.
          </span>
        </div>
      </div>
      <Submit
        pending={pending}
        label="Salvar configuração"
        busy="Salvando..."
      />
    </form>
  );
}

/* ------------------------------------------------------------------- edits */

export function MovementEditForm({
  id,
  today,
  initial,
}: {
  id: string;
  today: string;
  initial: {
    type: string;
    first: string;
    last: string;
    occurredOn: string;
    reference: string;
    notes: string;
  };
}) {
  const [state, action, pending] = useActionState(editMovement, IDLE);
  const [type, setType] = useState(initial.type);
  return (
    <form action={action} className={CARD}>
      <Feedback state={state} />
      <input type="hidden" name="id" value={id} />
      <fieldset>
        <legend className={LABEL}>O que aconteceu com as folhas?</legend>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {TYPES.map((t) => (
            <label
              key={t.value}
              className={`flex cursor-pointer items-center gap-2 rounded-[10px] border px-3 py-2.5 text-[12.5px] font-bold text-admin-primary ${
                type === t.value
                  ? "border-admin-primary bg-admin-success-bg"
                  : "border-admin-border bg-admin-card"
              }`}
            >
              <input
                type="radio"
                name="tipo"
                value={t.value}
                checked={type === t.value}
                onChange={() => setType(t.value)}
              />
              {t.label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label htmlFor="me-first" className={LABEL}>
            Primeira folha
          </label>
          <input
            id="me-first"
            name="primeira"
            required
            defaultValue={initial.first}
            className={`${FIELD} font-mono`}
          />
        </div>
        <div>
          <label htmlFor="me-last" className={LABEL}>
            Última folha
          </label>
          <input
            id="me-last"
            name="ultima"
            defaultValue={initial.last}
            className={`${FIELD} font-mono`}
          />
        </div>
        <div>
          <label htmlFor="me-date" className={LABEL}>
            Data
          </label>
          <input
            id="me-date"
            name="data"
            type="date"
            required
            max={today}
            defaultValue={initial.occurredOn}
            className={FIELD}
          />
        </div>
        <div className="md:col-span-2">
          <label htmlFor="me-ref" className={LABEL}>
            Referência (atos, motivo, boletim de ocorrência)
          </label>
          <input
            id="me-ref"
            name="referencia"
            maxLength={300}
            defaultValue={initial.reference}
            className={FIELD}
          />
        </div>
        <div>
          <label htmlFor="me-notes" className={LABEL}>
            Observações
          </label>
          <input
            id="me-notes"
            name="observacoes"
            maxLength={5000}
            defaultValue={initial.notes}
            className={FIELD}
          />
        </div>
      </div>
      <Submit pending={pending} label="Salvar alterações" busy="Salvando..." />
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
            Data do documento
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
                {s.title ? `, ${s.title}` : ""}
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
          <strong>Refazer os números com o classificador de agora</strong> (use
          depois de corrigir um lote ou um lançamento). O número do ofício
          continua o mesmo.
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
      question="Excluir este documento?"
      consequence="Ele sai da lista, mas continua guardado, com a justificativa. O número não é reaproveitado. Se era a prestação do trimestre, o lembrete volta."
      confirmLabel="Excluir"
      pendingLabel="Excluindo..."
    >
      <input type="hidden" name="id" value={id} />
    </ConfirmAction>
  );
}
