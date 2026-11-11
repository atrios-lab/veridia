"use client";

import { useActionState } from "react";
import { ConfirmAction } from "../../../_components/confirm-action.tsx";
import { type RemoveIssState, removeIssDeclaration } from "./actions.ts";

export function RemoveIssButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState<RemoveIssState, FormData>(
    removeIssDeclaration,
    { status: "idle" },
  );
  return (
    <ConfirmAction
      action={action}
      pending={pending}
      error={state.status === "error" ? state.message : null}
      trigger="Excluir"
      question="Excluir esta declaração?"
      consequence="Ela sai da lista e o número fica livre. O registro continua na auditoria."
      confirmLabel="Excluir"
      pendingLabel="Excluindo..."
    >
      <input type="hidden" name="id" value={id} />
    </ConfirmAction>
  );
}
