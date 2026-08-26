"use client";

import { useActionState, useRef, useState } from "react";
import { actsOfAttribution } from "@/core/acts/catalog.ts";
import type { Attribution, Tenant } from "@/core/tenant/schema.ts";
import { AdminIcon } from "../../../_components/icon.tsx";
import {
  createManualServiceRequest,
  type ManualEntryState,
} from "./actions.ts";

const FIELD_CLASS =
  "w-full rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3.5 py-2.5 text-[13.5px] text-admin-text outline-none focus:border-admin-primary-soft";
const LABEL_CLASS = "mb-1.5 block text-xs font-bold text-admin-primary";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1.5 text-xs font-semibold text-admin-error-text">
      {message}
    </p>
  );
}

const STEPS = ["Dados do pedido", "Impressão"] as const;

/**
 * The counter's two moments: filling the request, then handing the paper over.
 * Its own component rather than the public site's `Stepper`: that one is fixed
 * at three steps and paints itself with `--color-brand-*`, and the panel reads
 * `--color-admin-*` on purpose, so the two can change independently.
 */
function Stepper({ current }: { current: 1 | 2 }) {
  return (
    <ol className="mb-5 flex items-center gap-3">
      {STEPS.map((label, index) => {
        const step = index + 1;
        const done = step < current;
        const active = step === current;
        return (
          <li
            key={label}
            className={`flex items-center gap-2.5 ${
              step < STEPS.length ? "flex-1" : ""
            }`}
          >
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12.5px] font-bold ${
                done
                  ? "bg-admin-primary-soft text-white"
                  : active
                    ? "bg-admin-primary text-white"
                    : "bg-admin-border text-admin-faint"
              }`}
            >
              {done ? (
                <AdminIcon
                  name="check"
                  className="h-3.5 w-3.5"
                  strokeWidth={3}
                />
              ) : (
                step
              )}
            </span>
            <span
              className={`text-[13px] ${
                active
                  ? "font-bold text-admin-primary"
                  : "font-semibold text-admin-faint"
              }`}
            >
              {label}
            </span>
            {step < STEPS.length && (
              <span
                className={`h-0.5 flex-1 ${
                  done ? "bg-admin-primary-soft" : "bg-admin-border"
                }`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function ManualEntryForm({
  tenant,
  fromConversation,
}: {
  tenant: Tenant;
  fromConversation?: { id: string; name: string; contact: string };
}) {
  const [attribution, setAttribution] = useState<Attribution>(
    tenant.attributions[0],
  );
  const acts = actsOfAttribution(tenant, attribution);
  const [actId, setActId] = useState(acts[0]?.id ?? "");
  const act = acts.find((a) => a.id === actId) ?? acts[0];

  const [state, formAction, pending] = useActionState<
    ManualEntryState,
    FormData
  >(createManualServiceRequest, { status: "idle" });
  const fieldErrors = state.status === "error" ? state.fieldErrors : {};

  if (state.status === "success") {
    return (
      <>
        <Stepper current={2} />
        <SuccessScreen state={state} />
      </>
    );
  }

  return (
    <>
      <Stepper current={1} />
      <form
        action={formAction}
        className="rounded-[14px] border border-admin-border bg-admin-card p-6.5"
      >
        {fromConversation && (
          <>
            <input
              type="hidden"
              name="fromConversationId"
              value={fromConversation.id}
            />
            <p className="mb-4.5 rounded-[10px] border border-admin-input-border bg-admin-input-bg px-3.5 py-2.5 text-[12.5px] text-admin-muted">
              A partir da conversa com <b>{fromConversation.name}</b>. Ao
              registrar, o atendimento é encerrado e vinculado a este pedido.
            </p>
          </>
        )}
        <span className="mb-3 block text-[11.5px] font-bold uppercase tracking-[0.09em] text-admin-accent">
          Atribuição
        </span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {tenant.attributions.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => {
                setAttribution(a);
                setActId(actsOfAttribution(tenant, a)[0]?.id ?? "");
              }}
              className={
                a === attribution
                  ? "rounded-[9px] border-[1.5px] border-admin-primary-soft bg-admin-input-bg px-3 py-2 text-center text-[12.5px] font-bold text-admin-primary"
                  : "rounded-[9px] border border-admin-border px-3 py-2 text-center text-[12.5px] font-semibold text-admin-muted"
              }
            >
              {a}
            </button>
          ))}
        </div>

        <div className="mt-5">
          <label className={LABEL_CLASS} htmlFor="actId">
            Ato
          </label>
          <div className="relative">
            <select
              id="actId"
              name="actId"
              value={actId}
              onChange={(event) => setActId(event.target.value)}
              className={`appearance-none pr-9 ${FIELD_CLASS}`}
            >
              {acts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <AdminIcon
              name="chevronDown"
              className="pointer-events-none absolute top-1/2 right-3.5 h-3.5 w-3.5 -translate-y-1/2 text-admin-muted"
              strokeWidth={2}
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3.5 md:grid-cols-2">
          <div>
            <label className={LABEL_CLASS} htmlFor="applicantName">
              Nome do solicitante
            </label>
            <input
              id="applicantName"
              name="applicantName"
              defaultValue={fromConversation?.name}
              className={FIELD_CLASS}
            />
            <FieldError message={fieldErrors.applicantName} />
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="cpf">
              CPF (opcional)
            </label>
            <input
              id="cpf"
              name="cpf"
              placeholder="000.000.000-00"
              className={FIELD_CLASS}
            />
            <FieldError message={fieldErrors.cpf} />
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="contact">
              E-mail ou WhatsApp
            </label>
            <input
              id="contact"
              name="contact"
              defaultValue={fromConversation?.contact}
              placeholder="Para avisar sobre o andamento"
              className={FIELD_CLASS}
            />
            <FieldError message={fieldErrors.contact} />
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="amount">
              Valor (se já souber)
            </label>
            <input
              id="amount"
              name="amount"
              inputMode="decimal"
              placeholder="Pode informar depois"
              className={FIELD_CLASS}
            />
          </div>
        </div>

        {act?.requiresPurpose && (
          <div className="mt-3.5">
            <label className={LABEL_CLASS} htmlFor="purpose">
              Finalidade
            </label>
            <input id="purpose" name="purpose" className={FIELD_CLASS} />
            <FieldError message={fieldErrors.purpose} />
          </div>
        )}

        <div className="mt-3.5">
          <label className={LABEL_CLASS} htmlFor="description">
            Observações
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            placeholder="Detalhes do pedido, documentos já entregues em mãos…"
            className={FIELD_CLASS}
          />
          <FieldError message={fieldErrors.description} />
        </div>

        <label className="mt-4.5 flex items-center gap-2.5 rounded-[10px] border border-admin-border bg-admin-input-bg px-3.5 py-3">
          <input
            type="checkbox"
            name="counter"
            defaultChecked
            className="h-[18px] w-[18px] accent-admin-primary-soft"
          />
          <span className="text-[12.5px] text-admin-text">
            Pedido recebido presencialmente no balcão: documentos já estão em
            mãos da serventia.
          </span>
        </label>

        {state.status === "error" && (
          <p
            role="alert"
            className="mt-4 rounded-lg bg-admin-error-bg px-3.5 py-2.5 text-sm font-semibold text-admin-error-text"
          >
            {state.message}
          </p>
        )}

        <div className="mt-5.5 flex items-center gap-3.5">
          <button
            type="submit"
            disabled={pending}
            className="btn btn-admin-primary btn-lg"
          >
            {pending ? "Registrando…" : "Registrar pedido"}
          </button>
          <span className="text-[12px] text-admin-faint">
            Gera o protocolo REQ e a chave de acesso, como no site público.
          </span>
        </div>
      </form>
    </>
  );
}

type SuccessState = Extract<ManualEntryState, { status: "success" }>;

/** One of the two documents the counter prints, as data. */
interface Printable {
  key: "requerimento" | "comprovante";
  title: string;
  tag: string;
  /** Tags read as opposites on purpose: one stays, one leaves. */
  tagTone: "stays" | "leaves";
  icon: "file" | "lock";
  description: string;
}

const PRINTABLES: Printable[] = [
  {
    key: "requerimento",
    title: "Requerimento",
    tag: "Fica na serventia",
    tagTone: "stays",
    icon: "file",
    description:
      "O requerente assina e a folha vai para o arquivo. Não contém a chave, " +
      "por isso pode ser reimpresso depois, pelo detalhe do pedido.",
  },
  {
    key: "comprovante",
    title: "Comprovante de acesso",
    tag: "Vai com o cidadão",
    tagTone: "leaves",
    icon: "lock",
    description:
      "A única folha com a chave. Só sai enquanto esta tela estiver aberta: " +
      "depois, apenas emitindo uma chave nova, o que invalida esta.",
  },
];

/** Protocol or key, as a labelled block with its own copy button. */
function CredentialBlock({
  label,
  value,
  note,
  guarded,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  note: string;
  /** The key: framed as a credential, not as a second protocol. */
  guarded?: boolean;
  /** Absent while idle; carries whether the clipboard actually took it. */
  copied?: { ok: boolean };
  onCopy: () => void;
}) {
  return (
    <div
      className={
        guarded
          ? "flex-1 rounded-[10px] border border-admin-warning-text/25 bg-admin-warning-bg p-3.5"
          : "flex-1 rounded-[10px] border border-admin-input-border bg-admin-input-bg p-3.5"
      }
    >
      <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.11em] text-admin-muted">
        {guarded && <AdminIcon name="lock" className="h-3 w-3" />}
        {label}
      </span>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span className="font-mono text-[17px] font-bold tracking-[0.06em] text-admin-primary">
          {value}
        </span>
        <button
          type="button"
          onClick={onCopy}
          aria-label={`Copiar ${label.toLowerCase()}`}
          className="btn btn-admin-secondary btn-sm shrink-0"
        >
          <AdminIcon
            name={copied?.ok ? "check" : "copy"}
            className="h-3.5 w-3.5"
            strokeWidth={2}
          />
        </button>
      </div>
      {/* The note gives way to the copy result, so success and failure land
          in the same spot the eye is already on, instead of a toast the
          operator may never look at. */}
      {copied ? (
        <output
          className={`mt-1.5 block text-[11.5px] font-semibold leading-snug ${
            copied.ok ? "text-admin-success-text" : "text-admin-error-text"
          }`}
        >
          {copied.ok
            ? "Copiado."
            : "O navegador recusou o acesso à área de transferência. Selecione e copie à mão."}
        </output>
      ) : (
        <p
          className={`mt-1.5 text-[11.5px] leading-snug ${
            guarded ? "text-admin-warning-text" : "text-admin-muted"
          }`}
        >
          {note}
        </p>
      )}
    </div>
  );
}

function SummaryField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="block text-[10px] font-bold uppercase tracking-[0.11em] text-admin-muted">
        {label}
      </span>
      <span className="mt-0.5 block text-[13px] text-admin-text">{value}</span>
    </div>
  );
}

function SuccessScreen({ state }: { state: SuccessState }) {
  const [copied, setCopied] = useState<{
    which: "protocolo" | "chave";
    ok: boolean;
  } | null>(null);
  const [printed, setPrinted] = useState<Printable["key"][]>([]);
  const [sheetBlocked, setSheetBlocked] = useState(false);
  const receiptFormRef = useRef<HTMLFormElement>(null);
  const printHref = `/admin/pedidos/${encodeURIComponent(state.protocolNumber)}/imprimir`;

  const receiptPrinted = printed.includes("comprovante");
  const summary = [
    { label: "Contato", value: state.contact },
    ...(state.cpfLabel ? [{ label: "CPF", value: state.cpfLabel }] : []),
    { label: "Atribuição", value: state.attributionLabel },
    ...(state.amountLabel
      ? [{ label: "Valor", value: state.amountLabel }]
      : []),
  ];

  /**
   * Awaited and caught, never fired and forgotten: `writeText` rejects on a
   * denied permission or outside a secure context, and a check mark over a
   * clipboard that stayed empty is the worst kind of lie here. The operator
   * would walk away believing they had the key.
   */
  async function copy(which: "protocolo" | "chave") {
    const text = which === "protocolo" ? state.protocolNumber : state.accessKey;
    try {
      await navigator.clipboard.writeText(text);
      setCopied({ which, ok: true });
    } catch {
      setCopied({ which, ok: false });
    }
    setTimeout(() => setCopied(null), 2500);
  }

  /**
   * Marks a document as asked for. Nothing on this side can know whether paper
   * came out of a printer, so the label below says "enviado para impressão"
   * and never "impresso": the honest claim is the one the screen can back.
   */
  function markPrinted(key: Printable["key"]) {
    setPrinted((current) =>
      current.includes(key) ? current : [...current, key],
    );
    if (key === "requerimento") setSheetBlocked(false);
  }

  /**
   * One click cannot reliably open two tabs: a browser lets a gesture through
   * once and blocks whatever follows. So the order is deliberate and the
   * result is checked.
   *
   * The receipt goes first, by form submit, because it is the irreversible
   * one: the key it carries stops existing when this screen does. The
   * requerimento follows through `window.open`, which returns null when it is
   * refused, and that is the only one of the two whose failure this page can
   * actually see. Blocked, it says so and leaves its own button to finish the
   * job, instead of ticking a box over a tab that never opened.
   */
  function printBoth() {
    receiptFormRef.current?.requestSubmit();
    const opened = window.open(printHref, "_blank");
    setPrinted(opened ? PRINTABLES.map((p) => p.key) : ["comprovante"]);
    setSheetBlocked(!opened);
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-[14px] border border-admin-border bg-admin-card p-6">
        <div className="flex items-start gap-3.5">
          <span className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-full bg-admin-success-bg">
            <AdminIcon
              name="check"
              className="h-4.5 w-4.5 text-admin-success-text"
              strokeWidth={2.5}
            />
          </span>
          <div className="min-w-0">
            <h3 className="font-serif text-[19px] font-semibold text-admin-primary">
              Pedido registrado
            </h3>
            <p className="mt-0.5 text-[13px] text-admin-muted">
              {state.actName} ·{" "}
              <b className="font-semibold text-admin-text">
                {state.applicantName}
              </b>{" "}
              · {state.filedAtLabel}
            </p>
          </div>
        </div>

        <div className="mt-4.5 flex flex-col gap-3 sm:flex-row">
          <CredentialBlock
            label="Protocolo"
            value={state.protocolNumber}
            note="Público. Identifica o pedido e pode ser consultado e repetido sempre."
            copied={copied?.which === "protocolo" ? copied : undefined}
            onCopy={() => copy("protocolo")}
          />
          <CredentialBlock
            label="Chave de acesso"
            value={state.accessKey}
            note="Existe só nesta tela. O sistema guarda apenas uma versão cifrada: ao sair ou recarregar, ela não volta."
            guarded
            copied={copied?.which === "chave" ? copied : undefined}
            onCopy={() => copy("chave")}
          />
        </div>

        <div className="mt-4.5 grid grid-cols-2 gap-4 border-t border-admin-border pt-4 sm:grid-cols-4">
          {summary.map((field) => (
            <SummaryField key={field.label} {...field} />
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-[14px] border border-admin-border bg-admin-card">
        <div className="flex flex-wrap items-center gap-3 p-5">
          <div className="min-w-0 flex-1">
            <h4 className="font-serif text-[16px] font-semibold text-admin-primary">
              Imprimir agora
            </h4>
            <p className="mt-0.5 text-[12px] text-admin-muted">
              Cada impressão fica registrada na auditoria, com quem imprimiu e
              quando.
            </p>
          </div>
          <span className="rounded-full bg-admin-surface px-2.5 py-1 text-[11px] font-bold text-admin-muted">
            {printed.length} de {PRINTABLES.length}
          </span>
          <button
            type="button"
            onClick={printBoth}
            className="btn btn-admin-primary btn-md"
          >
            <AdminIcon name="printer" className="h-4 w-4" strokeWidth={2} />
            Imprimir os dois
          </button>
        </div>

        {PRINTABLES.map((doc) => (
          <PrintableRow
            key={doc.key}
            doc={doc}
            printed={printed.includes(doc.key)}
            blocked={doc.key === "requerimento" && sheetBlocked}
            printHref={printHref}
            accessKey={state.accessKey}
            receiptFormRef={receiptFormRef}
            onPrint={() => markPrinted(doc.key)}
          />
        ))}

        {/*
          The screen's one irreversible fact, kept where the exit is: leaving
          before the receipt is out costs the citizen their access, and no
          amount of copy elsewhere is read at the moment the operator reaches
          for "voltar à fila".
        */}
        <div
          className={`flex flex-wrap items-center gap-3 border-t px-5 py-3.5 ${
            receiptPrinted
              ? "border-admin-border bg-admin-surface"
              : "border-admin-warning-text/20 bg-admin-warning-bg"
          }`}
        >
          <AdminIcon
            name={receiptPrinted ? "checkCircle" : "alert"}
            className={`h-4 w-4 flex-none ${
              receiptPrinted
                ? "text-admin-success-text"
                : "text-admin-warning-text"
            }`}
          />
          <span
            className={`min-w-0 flex-1 text-[12px] font-semibold ${
              receiptPrinted ? "text-admin-muted" : "text-admin-warning-text"
            }`}
          >
            {receiptPrinted
              ? "O comprovante saiu. A chave pode ser esquecida com segurança."
              : "O comprovante ainda não saiu. Finalizar agora apaga a chave, e o cidadão fica sem acesso."}
          </span>
        </div>
      </section>

      {/* The way out of the wizard, and the only one: the pedido is already
          filed, so this closes the counter's turn rather than saving
          anything. */}
      <div className="flex flex-wrap items-center justify-end gap-3.5">
        <span className="mr-auto text-[12px] text-admin-faint">
          O pedido já está na fila. Isto encerra o atendimento no balcão.
        </span>
        <a href="/admin/pedidos" className="btn btn-admin-primary btn-md">
          Finalizar pedido
        </a>
      </div>
    </div>
  );
}

/**
 * One document's row. The two halves reach the same route by different verbs,
 * so the control differs: the requerimento is a plain link (GET, nothing to
 * send), and the receipt is a real submit button inside its own POST form,
 * because the key has to travel in the body. That is the same shape the
 * public site already uses to hand a PDF over (see protocol-lookup.tsx): a
 * submit button inside the form is the strongest user gesture there is, and
 * it needs no script to fire.
 */
function PrintableRow({
  doc,
  printed,
  blocked,
  printHref,
  accessKey,
  receiptFormRef,
  onPrint,
}: {
  doc: Printable;
  printed: boolean;
  /** The browser refused the tab this document was sent to. */
  blocked?: boolean;
  printHref: string;
  accessKey: string;
  receiptFormRef: React.RefObject<HTMLFormElement | null>;
  onPrint: () => void;
}) {
  const label = printed ? "Imprimir de novo" : "Imprimir";
  const leaves = doc.tagTone === "leaves";

  return (
    <div className="flex items-start gap-3.5 border-t border-admin-border px-5 py-4">
      <span
        className={`mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-[9px] ${
          leaves ? "bg-admin-warning-bg" : "bg-admin-surface"
        }`}
      >
        <AdminIcon
          name={doc.icon}
          className={`h-4 w-4 ${
            leaves ? "text-admin-warning-text" : "text-admin-primary-soft"
          }`}
        />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13.5px] font-bold text-admin-primary">
            {doc.title}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.07em] ${
              leaves
                ? "bg-admin-warning-bg text-admin-warning-text"
                : "bg-admin-success-bg text-admin-success-text"
            }`}
          >
            {doc.tag}
          </span>
          {printed && (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-admin-success-text">
              <AdminIcon name="check" className="h-3 w-3" strokeWidth={3} />
              Enviado para impressão
            </span>
          )}
        </div>
        <p className="mt-1 text-[12px] leading-snug text-admin-muted">
          {doc.description}
        </p>
        {blocked && (
          <p className="mt-1.5 text-[11.5px] font-semibold leading-snug text-admin-error-text">
            O navegador bloqueou a aba deste documento. Use o botão ao lado para
            abri-lo.
          </p>
        )}
      </div>
      {doc.key === "comprovante" ? (
        <form
          ref={receiptFormRef}
          method="post"
          action={printHref}
          target="_blank"
          rel="noopener"
          className="shrink-0"
        >
          <input type="hidden" name="chave" value={accessKey} />
          <button
            type="submit"
            onClick={onPrint}
            className="btn btn-admin-secondary btn-sm"
          >
            {label}
          </button>
        </form>
      ) : (
        <a
          href={printHref}
          target="_blank"
          rel="noreferrer"
          onClick={onPrint}
          className="btn btn-admin-secondary btn-sm shrink-0"
        >
          {label}
        </a>
      )}
    </div>
  );
}
