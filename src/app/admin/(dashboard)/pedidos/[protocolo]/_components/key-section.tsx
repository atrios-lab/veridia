"use client";

import { useActionState } from "react";
import { ConfirmAction } from "../../../../_components/confirm-action.tsx";
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
      <div className="mt-2.5">
        <ConfirmAction
          action={action}
          pending={pending}
          error={state.status === "error" ? state.message : null}
          trigger="Emitir nova chave"
          question="Emitir uma nova chave de acesso?"
          consequence="A chave atual para de funcionar na hora, e quem já tiver a antiga perde o acesso à consulta até receber a nova. A nova só aparece uma vez, nesta tela."
          confirmLabel="Confirmar emissão"
          pendingLabel="Emitindo…"
        >
          <input type="hidden" name="requestId" value={requestId} />
        </ConfirmAction>
      </div>
    </div>
  );
}
