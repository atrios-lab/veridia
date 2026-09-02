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
 * request's deliveries.
 */
function RequirementForms({
  requestId,
  requirementId,
  forms,
}: {
  requestId: string;
  requirementId: string;
  forms: AttachmentItem[];
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    attachRequirementFormAction,
    { status: "idle" },
  );

  return (
    <div className="mt-2.5 border-t border-admin-border pt-2.5">
      {forms.length > 0 && (
        <div className="mb-2 flex flex-col gap-2">
          {forms.map((form) => (
            <AttachmentRow
              key={form.id}
              requestId={requestId}
              attachment={form}
              meta="anexado em"
              onDelete={deleteAttachmentAction}
            />
          ))}
        </div>
      )}
      <form action={action}>
        <input type="hidden" name="requestId" value={requestId} />
        <input type="hidden" name="requirementId" value={requirementId} />
        <label
          className={`relative flex cursor-pointer items-center justify-center gap-2 rounded-[9px] border-[1.5px] border-dashed border-admin-input-border px-3 py-2 text-center text-[12px] font-semibold text-admin-primary focus-within:border-admin-accent focus-within:ring-2 focus-within:ring-admin-accent ${pending ? "cursor-not-allowed opacity-60" : ""}`}
        >
          {pending
            ? "Enviando…"
            : forms.length
              ? "Anexar outro formulário"
              : "Anexar formulário para o cidadão imprimir"}
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
      {state.status === "error" && (
        <p
          role="alert"
          className="mt-1.5 text-[11.5px] font-semibold text-admin-error-text"
        >
          {state.message}
        </p>
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

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
    if (state.status === "error") toast.error(state.message);
  }, [state]);

  const closed = requirement.status === "fulfilled";
  const last = requirement.messages.at(-1);
  const awaitingOffice = !closed && last?.author === "citizen";

  if (closed && requirement.messages.length === 0) return null;

  return (
    <div className="mt-3 border-t border-admin-border pt-3">
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
        <div className="mt-2.5 flex flex-col gap-2.5">
          {requirement.messages.map((message) => (
            <div key={message.id} className="flex items-start gap-2.5">
              <Initials
                name={message.authorName}
                staff={message.author === "staff"}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-[12.5px] font-bold text-admin-primary">
                    {message.authorName}
                  </span>
                  <span className="text-[11px] text-admin-faint">
                    {formatDayMonthTime(message.createdAt)}
                  </span>
                </div>
                {message.body && (
                  <p className="mt-1 whitespace-pre-line rounded-[10px] bg-admin-input-bg px-3 py-2 text-[12.5px] leading-relaxed text-admin-text">
                    {message.body}
                  </p>
                )}
                {message.attachments.map((file) => (
                  <a
                    key={file.id}
                    href={documentHref(requestId, file.id)}
                    target="_blank"
                    rel="noopener"
                    className="mt-1.5 inline-flex items-center gap-1.5 text-[12px] font-semibold text-admin-primary-soft underline-offset-2 hover:underline"
                  >
                    <AdminIcon name="file" className="h-3.5 w-3.5" />
                    {file.displayName}
                  </a>
                ))}
              </div>
            </div>
          ))}
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
              className="btn btn-admin-primary btn-md"
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
    >
      <input type="hidden" name="requirementId" value={requirement.id} />
    </ConfirmAction>
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
    <div className="rounded-[14px] border border-admin-border bg-admin-card p-6">
      <div className="flex items-center gap-2.5">
        <h4 className="flex-1 font-serif text-[17px] font-semibold text-admin-primary">
          Exigências
        </h4>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="btn btn-admin-secondary btn-sm"
          >
            + Registrar exigência
          </button>
        )}
      </div>
      <p className="mt-1 text-[12.5px] text-admin-muted">
        O que você registrar aqui aparece na consulta do cidadão, que responde
        por lá. Você confere e marca como cumprida.
      </p>

      {requirements.length > 0 && (
        <div className="mt-4 flex flex-col gap-2.5">
          {requirements.map((requirement) => (
            <div
              key={requirement.id}
              className={
                requirement.status === "pending"
                  ? "rounded-[11px] border border-admin-warning-bg bg-admin-card p-3.5"
                  : "rounded-[11px] border border-admin-border bg-admin-input-bg p-3.5 opacity-85"
              }
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={
                    requirement.status === "pending"
                      ? "rounded-full bg-admin-warning-bg px-2.5 py-0.5 text-[10.5px] font-bold text-admin-warning-text"
                      : "rounded-full bg-admin-success-bg px-2.5 py-0.5 text-[10.5px] font-bold text-admin-success-text"
                  }
                >
                  {requirement.status === "pending"
                    ? "Aguardando o cidadão"
                    : "Cumprida"}
                </span>
                <span className="text-[11.5px] text-admin-faint">
                  registrada em {formatDayMonth(requirement.createdAt)}
                  {requirement.fulfilledAt
                    ? ` · resolvida em ${formatDayMonth(requirement.fulfilledAt)}`
                    : ""}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed text-admin-text">
                {requirement.text}
              </p>
              {/* Kept for requirements resolved before the office took over
                  the verdict: the file the citizen sent then closed it by
                  itself. New ones carry their answers in the conversation. */}
              {requirement.resolutionFileName &&
                requirement.resolutionAttachmentId && (
                  <a
                    href={documentHref(
                      requestId,
                      requirement.resolutionAttachmentId,
                    )}
                    className="mt-1.5 inline-block text-[12px] font-semibold text-admin-success-text underline-offset-2 hover:underline"
                  >
                    {requirement.resolutionFileName}
                  </a>
                )}
              <RequirementForms
                requestId={requestId}
                requirementId={requirement.id}
                forms={requirement.forms}
              />

              <RequirementConversation
                requirement={requirement}
                requestId={requestId}
              />

              {/* Only while pending: a fulfilled requirement is the record of
                  what was asked and met, and records do not get edited. */}
              {requirement.status === "pending" && (
                <div className="mt-3 flex flex-wrap items-center gap-2.5 border-t border-admin-border pt-3">
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
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {editing && (
        <form
          action={action}
          className="mt-4 flex flex-col items-start gap-2.5 border-t border-admin-border pt-4"
        >
          <input type="hidden" name="requestId" value={requestId} />
          <textarea
            name="text"
            rows={4}
            placeholder="O que falta para o pedido seguir?"
            className="w-full rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3.5 py-2.5 text-[13px] text-admin-text placeholder:text-admin-faint"
          />
          <button
            type="submit"
            disabled={pending}
            className="btn btn-admin-primary btn-md"
          >
            {pending ? "Registrando…" : "Registrar"}
          </button>
        </form>
      )}
      {state.status === "error" && (
        <p
          role="alert"
          className="mt-2 text-[12.5px] font-semibold text-admin-error-text"
        >
          {state.message}
        </p>
      )}
    </div>
  );
}
