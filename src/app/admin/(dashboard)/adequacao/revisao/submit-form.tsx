"use client";

import { useActionState } from "react";
import { AdminIcon } from "../../../_components/icon.tsx";
import { type SubmitState, submitIntakeAction } from "../actions.ts";

export function SubmitForm({
  ready,
  officeEmail,
  submittedAt,
}: {
  ready: boolean;
  officeEmail: string;
  submittedAt: string | null;
}) {
  const [state, formAction, pending] = useActionState<SubmitState, FormData>(
    submitIntakeAction,
    { status: "idle" },
  );

  if (state.status === "sent") {
    return (
      <section className="rounded-[14px] border border-admin-primary-soft bg-admin-card p-6">
        <p className="flex items-start gap-2.5 text-[13px] leading-relaxed text-admin-text">
          <AdminIcon
            name="checkCircle"
            className="mt-0.5 h-4.5 w-4.5 flex-none text-admin-success-text"
          />
          <span>
            <strong className="block font-serif text-[16px] font-semibold text-admin-primary">
              Recebemos.
            </strong>
            A Átrios revisa as respostas, confirma o que precisar com você pelo
            WhatsApp e entrega os documentos pessoalmente. Mandamos a
            confirmação para {officeEmail}. Se corrigir algo depois, a Átrios vê
            a alteração por aqui.
          </span>
        </p>
      </section>
    );
  }

  return (
    <form
      action={formAction}
      className="rounded-[14px] border border-admin-border bg-admin-card p-6"
    >
      <label className="flex items-start gap-3 rounded-[10px] border border-admin-border bg-admin-input-bg px-4 py-3.5 text-[13px] leading-relaxed text-admin-text">
        <input
          type="checkbox"
          name="declaration"
          required
          className="mt-0.5 h-4.5 w-4.5 flex-none accent-admin-primary-soft"
        />
        Declaro que as informações são verdadeiras e autorizo a Átrios a usá-las
        para elaborar a documentação de adequação da serventia.
      </label>
      {state.status === "error" && (
        <p
          role="alert"
          className="mt-3.5 rounded-lg bg-admin-error-bg px-3.5 py-2.5 text-sm font-semibold text-admin-error-text"
        >
          {state.message}
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3.5">
        <button
          type="submit"
          disabled={!ready || pending}
          className="btn btn-admin-primary btn-lg"
        >
          {pending
            ? "Enviando…"
            : submittedAt
              ? "Enviar de novo para a Átrios"
              : "Enviar para a Átrios"}
        </button>
        <span className="text-[12px] text-admin-muted">
          {ready
            ? `A Átrios recebe um aviso por e-mail. A confirmação vai para ${officeEmail}.`
            : "O envio abre quando todas as seções estiverem concluídas."}
        </span>
      </div>
    </form>
  );
}
