"use client";

import { useActionState } from "react";
import { type ReissueKeyState, reissueKeyAction } from "../actions.ts";

export function KeySection({
  requestId,
  issuedLabel,
}: {
  requestId: string;
  issuedLabel: string;
}) {
  const [state, action, pending] = useActionState<ReissueKeyState, FormData>(
    reissueKeyAction,
    { status: "idle" },
  );

  return (
    <div className="rounded-[14px] border border-admin-border bg-admin-card p-4.5">
      <h4 className="font-serif text-[15.5px] font-semibold text-admin-primary">
        Chave de acesso
      </h4>
      <p className="mt-1 text-[12px] text-admin-muted">
        {state.status === "success"
          ? "Nova chave, mostrada só agora, guarde-a:"
          : `Ativa desde ${issuedLabel}. O cidadão usa junto do protocolo para ver o pedido completo.`}
      </p>
      <div className="mt-2.5 rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3.5 py-2.5 text-[14px] font-bold tracking-[0.2em] text-admin-primary">
        {state.status === "success" ? state.key : "••••  ••••  ••••"}
      </div>
      <form
        action={action}
        onSubmit={(event) => {
          if (
            !confirm(
              "Emitir uma nova chave invalida a anterior na hora. Continuar?",
            )
          ) {
            event.preventDefault();
          }
        }}
        className="mt-2.5"
      >
        <input type="hidden" name="requestId" value={requestId} />
        <button
          type="submit"
          disabled={pending}
          className="rounded-[8px] border border-admin-active-border px-3.5 py-1.5 text-[12px] font-bold text-admin-primary disabled:opacity-60"
        >
          {pending ? "Emitindo…" : "Emitir nova chave"}
        </button>
      </form>
      <p className="mt-2 text-[11px] text-admin-faint">
        Emitir uma nova invalida a chave anterior na hora.
      </p>
      {state.status === "error" && (
        <p
          role="alert"
          className="mt-2 text-[11.5px] font-semibold text-admin-error-text"
        >
          {state.message}
        </p>
      )}
    </div>
  );
}
