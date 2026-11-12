"use client";

import { useActionState } from "react";
import { AdminIcon } from "../../../_components/icon.tsx";
import { Button } from "../../../_ui/button.tsx";
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
      <section className="rounded-xl border border-success/30 bg-success-soft p-6">
        <p className="flex items-start gap-2.5 text-sm leading-relaxed text-foreground">
          <AdminIcon
            name="checkCircle"
            className="mt-0.5 h-4.5 w-4.5 flex-none text-success-text"
          />
          <span>
            <strong className="block text-base font-semibold text-foreground">
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
      className="rounded-xl border border-border bg-card p-6"
    >
      <label className="flex items-start gap-3 rounded-lg bg-muted/50 px-4 py-3.5 text-sm leading-relaxed text-foreground">
        <input
          type="checkbox"
          name="declaration"
          required
          className="checkbox-admin mt-0.5"
        />
        Declaro que as informações são verdadeiras e autorizo a Átrios a usá-las
        para elaborar a documentação de adequação da serventia.
      </label>
      {state.status === "error" && (
        <p
          role="alert"
          className="mt-3.5 rounded-lg border border-destructive/40 bg-destructive-soft px-3.5 py-2.5 text-sm font-medium text-destructive"
        >
          {state.message}
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" disabled={!ready || pending}>
          {pending
            ? "Enviando…"
            : submittedAt
              ? "Enviar de novo para a Átrios"
              : "Enviar para a Átrios"}
        </Button>
        <span className="text-xs text-muted-foreground">
          {ready
            ? `A Átrios recebe um aviso por e-mail. A confirmação vai para ${officeEmail}.`
            : "O envio abre quando todas as seções estiverem concluídas."}
        </span>
      </div>
    </form>
  );
}
