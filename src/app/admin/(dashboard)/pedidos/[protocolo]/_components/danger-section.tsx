"use client";

import { useActionState } from "react";
import { type ActionState, deleteRequestAction } from "../actions.ts";

export function DangerSection({ requestId }: { requestId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    deleteRequestAction,
    { status: "idle" },
  );

  return (
    <div>
      <form
        action={action}
        onSubmit={(event) => {
          if (
            !confirm(
              'Excluir este protocolo? Use só para abertura por engano. Para um pedido real que não deve seguir, prefira o andamento "Cancelado".',
            )
          ) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="requestId" value={requestId} />
        <button
          type="submit"
          disabled={pending}
          className="text-[12px] font-semibold text-admin-error-text underline disabled:opacity-60"
        >
          {pending ? "Excluindo…" : "Excluir protocolo"}
        </button>
      </form>
      <p className="mt-1.5 max-w-[280px] text-[11px] leading-relaxed text-admin-faint">
        Só para abertura por engano (protocolo duplicado, teste). Um pedido real
        que não deve seguir usa o andamento "Cancelado": ele fica no histórico.
      </p>
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
