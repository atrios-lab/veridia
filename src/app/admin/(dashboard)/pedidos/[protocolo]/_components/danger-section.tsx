"use client";

import { useActionState } from "react";
import { ConfirmAction } from "../../../../_components/confirm-action.tsx";
import { type ActionState, deleteRequestAction } from "../actions.ts";

export function DangerSection({ requestId }: { requestId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    deleteRequestAction,
    { status: "idle" },
  );

  return (
    <div>
      <ConfirmAction
        action={action}
        pending={pending}
        error={state.status === "error" ? state.message : null}
        trigger="Excluir protocolo"
        question="Excluir este protocolo?"
        consequence='O protocolo e os documentos anexados saem do sistema e não voltam. Use só para abertura por engano. Para um pedido real que não deve seguir, prefira o andamento "Cancelado", que fica no histórico.'
        confirmLabel="Confirmar exclusão"
        pendingLabel="Excluindo…"
      >
        <input type="hidden" name="requestId" value={requestId} />
      </ConfirmAction>
      <p className="mt-1.5 max-w-[280px] text-[11px] leading-relaxed text-admin-faint">
        Só para abertura por engano (protocolo duplicado, teste). Um pedido real
        que não deve seguir usa o andamento "Cancelado": ele fica no histórico.
      </p>
    </div>
  );
}
