"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "../../../_components/confirm-action.tsx";
import { type ActionState, removeBulletinAction } from "../actions.ts";

/** "Excluir" a bulletin published by mistake, with the reason. */
export function RemoveBulletinButton({
  id,
  label,
}: {
  id: string;
  /** "Outubro de 2026" */
  label: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    removeBulletinAction,
    { status: "idle" },
  );
  useEffect(() => {
    if (state.status === "success")
      toast.success(`Boletim de ${label} excluído.`);
  }, [state, label]);
  return (
    <ConfirmAction
      action={action}
      pending={pending}
      error={state.status === "error" ? state.message : null}
      trigger="Excluir"
      question={`Excluir o boletim de ${label}?`}
      consequence="Ele sai do site e da lista. O registro continua guardado, com a auditoria. Se publicar o mês de novo, ele volta com os números corrigidos."
      confirmLabel="Excluir boletim"
      pendingLabel="Excluindo..."
    >
      <input type="hidden" name="id" value={id} />
    </ConfirmAction>
  );
}
