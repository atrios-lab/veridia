"use client";

import { useActionState, useEffect, useState } from "react";
import type { AttachmentItem } from "../../../../_components/attachment-link.ts";
import { documentHref } from "../../../../_components/attachment-link.ts";
import { AttachmentRow } from "../../../../_components/attachment-row.tsx";
import {
  type ActionState,
  attachRequirementFormAction,
  deleteAttachmentAction,
  registerRequirementAction,
} from "../actions.ts";

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
}

function formatDayMonth(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

/**
 * The form the citizen has to print and present. It lives in the requirement's
 * card on both sides — here and in the protocol consult — and nowhere near the
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
          className={`flex cursor-pointer items-center justify-center gap-2 rounded-[9px] border-[1.5px] border-dashed border-admin-input-border px-3 py-2 text-center text-[12px] font-semibold text-admin-primary focus-within:border-admin-accent focus-within:ring-2 focus-within:ring-admin-accent ${pending ? "cursor-not-allowed opacity-60" : ""}`}
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
            className="rounded-lg border border-admin-active-border px-3 py-1.5 text-[12px] font-bold text-admin-muted"
          >
            + Registrar exigência
          </button>
        )}
      </div>
      <p className="mt-1 text-[12.5px] text-admin-muted">
        O que você registrar aqui aparece na consulta do cidadão e é cumprido
        por lá, sem precisar de e-mail nem telefone.
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
              <p className="mt-2 text-[13px] text-admin-text">
                {requirement.text}
              </p>
              {/* The file that answered the requirement has to open: reading
                  it is how the office decides whether the requirement is
                  actually met. No delete — it is the citizen's answer, and
                  the server refuses it anyway while a requirement points at
                  it. */}
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
            rows={2}
            placeholder="O que falta para o pedido seguir?"
            className="w-full rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3.5 py-2.5 text-[13px] text-admin-text placeholder:text-admin-faint"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-[9px] bg-admin-primary-soft px-4 py-2 text-[12.5px] font-bold text-white disabled:opacity-60"
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
