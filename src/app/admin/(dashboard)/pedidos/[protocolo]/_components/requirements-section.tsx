"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { AttachmentItem } from "../../../../_components/attachment-link.ts";
import { documentHref } from "../../../../_components/attachment-link.ts";
import { AttachmentRow } from "../../../../_components/attachment-row.tsx";
import { ConfirmAction } from "../../../../_components/confirm-action.tsx";
import { AdminIcon } from "../../../../_components/icon.tsx";
import { useEmailWarning } from "../../../../_components/use-email-warning.ts";
import {
  type ActionState,
  attachRequirementFormAction,
  deleteAttachmentAction,
  deleteRequirementAction,
  editRequirementAction,
  registerRequirementAction,
  replyRequirementAction,
  resolveRequirementAction,
} from "../actions.ts";

export interface RequirementMessageItem {
  id: string;
  author: "citizen" | "staff";
  authorName: string;
  body: string;
  createdAt: Date;
  attachments: Array<{ id: string; displayName: string }>;
}

export interface RequirementItem {
  id: string;
  text: string;
  status: "pending" | "fulfilled";
  createdAt: Date;
  fulfilledAt: Date | null;
  resolutionFileName?: string;
  resolutionAttachmentId?: string;
  /** Forms the office attached for the citizen to print and present. */
  forms: AttachmentItem[];
  /** The conversation inside this requirement, oldest first. */
  messages: RequirementMessageItem[];
}

function formatDayMonthTime(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(date)
    .replace(", ", " · ");
}

function formatDayMonth(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

/**
 * The form the citizen has to print and present. It lives in the requirement's
 * card on both sides, here and in the protocol consult, and nowhere near the
 * request's deliveries. The button is the whole control: picking a file sends
 * it.
 */
function AttachFormButton({
  requestId,
  requirementId,
}: {
  requestId: string;
  requirementId: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    attachRequirementFormAction,
    { status: "idle" },
  );
  useEffect(() => {
    if (state.status === "error") toast.error(state.message);
  }, [state]);

  return (
    <form action={action} className="ml-auto">
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="requirementId" value={requirementId} />
      <label
        className={`btn btn-admin-secondary btn-sm relative cursor-pointer focus-within:border-admin-accent ${pending ? "cursor-not-allowed opacity-60" : ""}`}
      >
        {pending ? "Enviando…" : "Anexar formulário"}
        <input
          type="file"
          name="formulario"
          accept="application/pdf,image/jpeg,image/png,image/webp,image/heic"
          className="sr-only"
          disabled={pending}
          onChange={(event) => {
            if (event.target.files?.length) {
              event.target.form?.requestSubmit();
            }
          }}
        />
      </label>
    </form>
  );
}

/** One file, in a line: icon, name, and when it came. */
function FileLine({
  href,
  name,
  meta,
  onShowConversation,
}: {
  href: string;
  name: string;
  meta: string;
  /** Opens the conversation the file arrived in, when there is one. */
  onShowConversation?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[12px] text-admin-muted">
      <AdminIcon
        name="file"
        className="h-[13px] w-[13px] flex-none text-admin-accent"
      />
      <a
        href={href}
        target="_blank"
        rel="noopener"
        className="font-semibold text-admin-primary-soft hover:underline"
      >
        {name}
      </a>
      {meta}
      {onShowConversation && (
        <>
          {" · "}
          <button
            type="button"
            onClick={onShowConversation}
            className="font-semibold text-admin-primary-soft hover:underline"
          >
            ver conversa
          </button>
        </>
      )}
    </div>
  );
}

/** Two letters in a circle, so a glance tells the two sides apart. */
function Initials({ name, staff }: { name: string; staff: boolean }) {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      className={`inline-flex h-8 w-8 flex-none items-center justify-center rounded-full text-[11px] font-bold ${
        staff
          ? "bg-admin-primary text-white"
          : "bg-admin-accent/20 text-admin-accent"
      }`}
      aria-hidden="true"
    >
      {letters || "?"}
    </span>
  );
}

/** A one-field form firing a requirement action. */
function RequirementAction({
  action,
  requirementId,
  className,
  successMessage,
  children,
}: {
  action: (p: ActionState, f: FormData) => Promise<ActionState>;
  requirementId: string;
  className: string;
  successMessage?: string;
  children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    action,
    { status: "idle" },
  );
  useEmailWarning(state);
  useEffect(() => {
    if (state.status === "success" && successMessage) {
      toast.success(successMessage);
    }
    if (state.status === "error") toast.error(state.message);
  }, [state, successMessage]);

  return (
    <form action={formAction} className="flex-none">
      <input type="hidden" name="requirementId" value={requirementId} />
      <button type="submit" disabled={pending} className={className}>
        {children}
      </button>
    </form>
  );
}

/**
 * The conversation of one requirement, inside its card. Its state is read off
 * the messages, never stored: the office is owed an answer when the last word
 * was the citizen's, and the whole thing closes when the requirement does.
 */
function RequirementConversation({
  requirement,
  requestId,
}: {
  requirement: RequirementItem;
  requestId: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    replyRequirementAction,
    { status: "idle" },
  );
  const formRef = useRef<HTMLFormElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
    if (state.status === "error") toast.error(state.message);
  }, [state]);

  // Same cap as the citizen's own /acompanhar thread: a long back-and-forth
  // scrolls inside a fixed height instead of pushing the reply box down.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-runs on a new message, the ref itself is never a reactive value.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "nearest" });
  }, [requirement.messages.length]);

  const closed = requirement.status === "fulfilled";
  const last = requirement.messages.at(-1);
  const awaitingOffice = !closed && last?.author === "citizen";

  if (closed && requirement.messages.length === 0) return null;

  return (
    <div className="border-t border-admin-border pt-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <h5 className="flex-1 font-serif text-[14px] font-semibold text-admin-primary">
          Perguntas do cidadão
        </h5>
        {awaitingOffice && (
          <span className="rounded-full bg-admin-accent px-2.5 py-0.5 text-[10.5px] font-bold text-white">
            Novo
          </span>
        )}
        {!awaitingOffice && requirement.messages.length > 0 && (
          <span className="rounded-full bg-admin-success-bg px-2.5 py-0.5 text-[10.5px] font-bold text-admin-success-text">
            {closed ? "Encerrada" : "Respondida"}
          </span>
        )}
      </div>

      {requirement.messages.length > 0 && (
        <div className="mt-2.5 flex max-h-80 flex-col gap-3 overflow-y-auto pr-1">
          {requirement.messages.map((message) => {
            const staff = message.author === "staff";
            return (
              <div
                key={message.id}
                className={`flex min-w-0 items-start gap-2.5 ${staff ? "flex-row-reverse" : ""}`}
              >
                <Initials name={message.authorName} staff={staff} />
                <div
                  className={`flex max-w-[85%] min-w-0 flex-col gap-1 ${staff ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`flex flex-wrap items-baseline gap-2 ${staff ? "flex-row-reverse" : ""}`}
                  >
                    <span className="text-[12.5px] font-bold text-admin-primary">
                      {message.authorName}
                    </span>
                    <span className="text-[11px] text-admin-faint">
                      {formatDayMonthTime(message.createdAt)}
                    </span>
                  </div>
                  {message.body && (
                    <p
                      className={`m-0 max-w-full min-w-0 [overflow-wrap:anywhere] rounded-[10px] px-3 py-2 text-[12.5px] leading-relaxed whitespace-pre-line ${
                        staff
                          ? "bg-admin-primary text-white"
                          : "bg-admin-input-bg text-admin-text"
                      }`}
                    >
                      {message.body}
                    </p>
                  )}
                  {message.attachments.map((file) => (
                    <a
                      key={file.id}
                      href={documentHref(requestId, file.id)}
                      target="_blank"
                      rel="noopener"
                      className="flex min-w-0 max-w-full items-center gap-1.5 rounded-[10px] border border-admin-border bg-admin-card px-3 py-1.5 text-[12px] font-semibold text-admin-primary-soft"
                    >
                      <AdminIcon name="file" className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{file.displayName}</span>
                    </a>
                  ))}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      )}

      {closed ? (
        <p className="mt-2.5 text-[11.5px] text-admin-faint">
          Exigência cumprida: a conversa está encerrada nos dois lados.
        </p>
      ) : (
        <form ref={formRef} action={action} className="mt-2.5">
          <input type="hidden" name="requirementId" value={requirement.id} />
          <textarea
            name="body"
            rows={2}
            disabled={pending}
            placeholder="Responder ao cidadão..."
            className="w-full rounded-[10px] border border-admin-input-border bg-admin-input-bg px-3.5 py-2.5 text-[12.5px] text-admin-text placeholder:text-admin-faint"
          />
          <div className="mt-2 flex justify-end">
            <button
              type="submit"
              disabled={pending}
              className="btn btn-admin-primary btn-sm"
            >
              {pending ? "Enviando…" : "Enviar resposta"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

/** Corrects the wording of a requirement the citizen has not answered yet. */
function EditRequirement({ requirement }: { requirement: RequirementItem }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    editRequirementAction,
    { status: "idle" },
  );

  useEffect(() => {
    if (state.status === "success") {
      toast.success("Exigência corrigida.");
      setOpen(false);
    }
    if (state.status === "error") toast.error(state.message);
  }, [state]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-admin-secondary btn-sm"
      >
        Editar
      </button>
    );
  }

  return (
    <form action={action} className="flex w-full flex-col gap-2">
      <input type="hidden" name="requirementId" value={requirement.id} />
      <textarea
        name="text"
        rows={4}
        defaultValue={requirement.text}
        className="w-full rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3.5 py-2.5 text-[13px] text-admin-text"
      />
      <div className="flex gap-2.5">
        <button
          type="submit"
          disabled={pending}
          className="btn btn-admin-primary btn-sm"
        >
          {pending ? "Salvando…" : "Salvar"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="btn btn-admin-secondary btn-sm"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

/** Undoes a requirement raised by mistake, with its conversation and files. */
function DeleteRequirement({ requirement }: { requirement: RequirementItem }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    async (previous, formData) => {
      const result = await deleteRequirementAction(previous, formData);
      if (result.status === "success") toast.success("Exigência excluída.");
      return result;
    },
    { status: "idle" },
  );

  return (
    <ConfirmAction
      action={action}
      pending={pending}
      error={state.status === "error" ? state.message : null}
      trigger="Excluir"
      question="Excluir esta exigência?"
      consequence="A exigência, a conversa com o cidadão e os arquivos enviados nela somem dos dois lados. Não dá para desfazer. Se ela já foi resolvida, marque como cumprida em vez de excluir."
      confirmLabel="Confirmar exclusão"
      pendingLabel="Excluindo…"
      triggerClassName="text-[12px] font-semibold text-admin-error-text hover:underline"
    >
      <input type="hidden" name="requirementId" value={requirement.id} />
    </ConfirmAction>
  );
}

/**
 * One requirement: what was asked, the files around it, its thread. Folded
 * once fulfilled: a request with three answered exigências is three lines,
 * not three threads. A pending one stays open, because it is the work.
 */
function RequirementCard({
  requirement,
  requestId,
}: {
  requirement: RequirementItem;
  requestId: string;
}) {
  const pendingReq = requirement.status === "pending";
  const last = requirement.messages.at(-1);
  const awaitingOffice = pendingReq && last?.author === "citizen";
  const [open, setOpen] = useState(pendingReq);
  const conversationRef = useRef<HTMLDivElement>(null);
  const showConversation = () =>
    conversationRef.current?.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  // What the citizen sent inside the thread, pulled up to the card so the
  // operator sees the files without reading the exchange.
  const citizenFiles = requirement.messages
    .filter((m) => m.author === "citizen")
    .flatMap((m) =>
      m.attachments.map((a) => ({ ...a, createdAt: m.createdAt })),
    );

  return (
    <div
      className={
        pendingReq
          ? "flex flex-col gap-2.5 rounded-[11px] border border-admin-warning-soft-border bg-admin-card px-4 py-3.5"
          : "flex flex-col gap-2 rounded-[11px] border border-admin-border bg-admin-input-bg px-4 py-3.5"
      }
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-2.5 text-left"
      >
        <span
          className={`flex-none rounded-full px-[9px] py-[3px] text-[10.5px] font-bold ${
            pendingReq
              ? "bg-admin-warning-soft-bg text-admin-accent"
              : "bg-admin-success-bg text-admin-success-text"
          }`}
        >
          {pendingReq ? "Aguardando o cidadão" : "Cumprida"}
        </span>
        <span className="flex-none text-[11.5px] text-admin-faint">
          registrada em {formatDayMonth(requirement.createdAt)}
          {requirement.fulfilledAt
            ? ` · resolvida em ${formatDayMonth(requirement.fulfilledAt)}`
            : ""}
        </span>
        {/* Folded, the first line of the text is the card's name. Not merely
            hidden when open: the text would then be on the page twice. */}
        {open ? (
          <span className="flex-1" />
        ) : (
          <span className="min-w-0 flex-1 truncate text-[13px] text-admin-text">
            {requirement.text}
          </span>
        )}
        {!open && awaitingOffice && (
          <span className="flex-none rounded-full bg-admin-accent px-2.5 py-0.5 text-[10.5px] font-bold text-white">
            Novo
          </span>
        )}
        <AdminIcon
          name="chevronDown"
          strokeWidth={2}
          className={`h-4 w-4 flex-none text-admin-text transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <>
          <p className="whitespace-pre-line text-[13px] leading-normal text-admin-text">
            {requirement.text}
          </p>
          {/* Kept for requirements resolved before the office took over the
              verdict: the file the citizen sent then closed it by itself. New
              ones carry their answers in the conversation, listed next. */}
          {requirement.resolutionFileName &&
            requirement.resolutionAttachmentId && (
              <FileLine
                href={documentHref(
                  requestId,
                  requirement.resolutionAttachmentId,
                )}
                name={requirement.resolutionFileName}
                meta={`enviado pelo cidadão${
                  requirement.fulfilledAt
                    ? ` em ${formatDayMonthTime(requirement.fulfilledAt)}`
                    : ""
                }`}
              />
            )}
          {citizenFiles.map((file) => (
            <FileLine
              key={file.id}
              href={documentHref(requestId, file.id)}
              name={file.displayName}
              meta={`enviado pelo cidadão em ${formatDayMonthTime(file.createdAt)}`}
              onShowConversation={showConversation}
            />
          ))}
          {/* While pending the office may still take a form back, so the full
              row with its "Excluir" stays; once fulfilled the file is part of
              the record and reads as a line. */}
          {requirement.forms.length > 0 &&
            (pendingReq ? (
              <div className="flex flex-col gap-2">
                {requirement.forms.map((form) => (
                  <AttachmentRow
                    key={form.id}
                    requestId={requestId}
                    attachment={form}
                    meta="anexado em"
                    onDelete={deleteAttachmentAction}
                  />
                ))}
              </div>
            ) : (
              requirement.forms.map((form) => (
                <FileLine
                  key={form.id}
                  href={documentHref(requestId, form.id)}
                  name={form.displayName}
                  meta={`anexado em ${form.createdAtLabel}`}
                />
              ))
            ))}

          <div ref={conversationRef}>
            <RequirementConversation
              requirement={requirement}
              requestId={requestId}
            />
          </div>

          {/* Only while pending: a fulfilled requirement is the record of
              what was asked and met, and records do not get edited. */}
          {pendingReq && (
            <div className="flex flex-wrap items-center gap-2.5 border-t border-admin-border pt-2.5">
              <RequirementAction
                action={resolveRequirementAction}
                requirementId={requirement.id}
                className="btn btn-admin-primary btn-sm"
                successMessage="Exigência marcada como cumprida."
              >
                Marcar como cumprida
              </RequirementAction>
              <EditRequirement requirement={requirement} />
              <DeleteRequirement requirement={requirement} />
              <AttachFormButton
                requestId={requestId}
                requirementId={requirement.id}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function RequirementsSection({
  requestId,
  requirements,
}: {
  requestId: string;
  requirements: RequirementItem[];
}) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    registerRequirementAction,
    { status: "idle" },
  );

  useEffect(() => {
    if (state.status === "success") setEditing(false);
  }, [state]);

  return (
    <div className="flex flex-col gap-3.5 rounded-[14px] border border-admin-border bg-admin-card px-6 py-[22px]">
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h4 className="font-serif text-[17px] font-semibold text-admin-primary">
            Exigências
          </h4>
          <p className="text-[12.5px] leading-normal text-admin-muted">
            O que você registrar aqui aparece na consulta do cidadão, que
            responde por lá. Você confere e marca como cumprida.
          </p>
        </div>
        {editing ? (
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="btn btn-admin-secondary btn-sm flex-none"
          >
            Cancelar
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="btn btn-admin-primary btn-sm flex-none gap-[7px] px-3.5 text-[12.5px]"
          >
            <AdminIcon name="plus" className="h-3.5 w-3.5" strokeWidth={2.4} />
            Registrar exigência
          </button>
        )}
      </div>

      {/* Right under the button that opened it, not after every card. */}
      {editing && (
        <form
          action={action}
          className="flex flex-col gap-2.5 rounded-[11px] border border-admin-warning-soft-border bg-admin-warning-soft-bg p-4"
        >
          <input type="hidden" name="requestId" value={requestId} />
          <span className="text-[12px] font-bold text-admin-accent">
            Nova exigência
          </span>
          <textarea
            name="text"
            rows={4}
            placeholder="O que falta para o pedido seguir? Escreva como falaria no balcão: o cidadão lê isso na consulta."
            className="min-h-[88px] w-full rounded-[9px] border border-admin-input-border bg-admin-card px-[13px] py-2.5 text-[13px] text-admin-text placeholder:text-admin-faint"
          />
          {state.status === "error" && (
            <p
              role="alert"
              className="text-[12.5px] font-semibold text-admin-error-text"
            >
              {state.message}
            </p>
          )}
          <div className="flex items-center gap-2.5">
            <button
              type="submit"
              disabled={pending}
              className="btn btn-admin-primary btn-md"
            >
              {pending ? "Registrando…" : "Registrar"}
            </button>
            {/* See `pauseReasons` in deadline.ts: the term stops while any
                requirement is pending, and only "Marcar como cumprida" ends
                that, not the citizen's answer. */}
            <span className="text-[11.5px] text-admin-faint">
              Suspende o prazo até você marcar como cumprida
            </span>
          </div>
        </form>
      )}

      {requirements.length === 0 && !editing && (
        <div className="flex items-center gap-3 border-t border-admin-border pt-4">
          <span className="inline-flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-admin-success-bg">
            <AdminIcon
              name="check"
              className="h-4 w-4 text-admin-success-text"
              strokeWidth={2}
            />
          </span>
          <div className="flex flex-col gap-0.5">
            <span className="text-[13.5px] font-semibold text-admin-text">
              Nenhuma exigência neste pedido
            </span>
            <span className="text-[12.5px] text-admin-muted">
              O pedido segue sem pendências com o cidadão.
            </span>
          </div>
        </div>
      )}

      {requirements.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {requirements.map((requirement) => (
            <RequirementCard
              key={requirement.id}
              requirement={requirement}
              requestId={requestId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
