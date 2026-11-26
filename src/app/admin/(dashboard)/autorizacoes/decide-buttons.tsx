"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "../../_components/confirm-action.tsx";
import { type DecideState, decideDeletionAction } from "./actions.ts";

const IDLE: DecideState = { status: "idle" };

function Decide({ id, approve }: { id: string; approve: boolean }) {
  const [state, action, pending] = useActionState(decideDeletionAction, IDLE);
  useEffect(() => {
    if (state.status === "success" && state.message)
      toast.success(state.message);
  }, [state]);
  return (
    <ConfirmAction
      action={action}
      pending={pending}
      error={state.status === "error" ? (state.message ?? null) : null}
      trigger={approve ? "Aprovar a exclusão" : "Recusar"}
      question={
        approve ? "Aprovar a exclusão deste documento?" : "Recusar o pedido?"
      }
      consequence={
        approve
          ? "O documento sai das listas, mas continua guardado e pode ser recuperado. Confirme o motivo; vai para a auditoria."
          : "O documento continua como está. Diga por que recusou; quem pediu vê a resposta na auditoria."
      }
      confirmLabel={approve ? "Aprovar" : "Recusar"}
      pendingLabel="Salvando…"
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="op" value={approve ? "aprovar" : "recusar"} />
    </ConfirmAction>
  );
}

export function DecideButtons({ id }: { id: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Decide id={id} approve />
      <Decide id={id} approve={false} />
    </div>
  );
}
