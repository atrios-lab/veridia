"use client";

import { useActionState, useEffect, useState } from "react";
import { type ActionState, registerRequirementAction } from "../actions.ts";

export interface RequirementItem {
  id: string;
  text: string;
  status: "pending" | "fulfilled";
  createdAt: Date;
  fulfilledAt: Date | null;
  resolutionFileName?: string;
}

function formatDayMonth(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
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
              {requirement.resolutionFileName && (
                <div className="mt-1.5 text-[12px] font-semibold text-admin-success-text">
                  {requirement.resolutionFileName}
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
