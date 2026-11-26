"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "../../../_components/confirm-action.tsx";
import { type RecoverState, recoverAction } from "./actions.ts";

const IDLE: RecoverState = { status: "idle" };

export function RecoverButton({
  fields,
  label,
  question,
}: {
  fields: Record<string, string>;
  label: string;
  question: string;
}) {
  const [state, action, pending] = useActionState(recoverAction, IDLE);
  useEffect(() => {
    if (state.status === "success" && state.message)
      toast.success(state.message);
  }, [state]);
  return (
    <ConfirmAction
      action={action}
      pending={pending}
      error={state.status === "error" ? (state.message ?? null) : null}
      trigger={label}
      question={question}
      consequence="Fica na auditoria, com a sua justificativa."
      confirmLabel={label}
      pendingLabel="Recuperando…"
      triggerClassName="inline-flex h-8 items-center rounded-md border bg-background px-3 text-sm font-medium shadow-xs hover:bg-muted"
    >
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
    </ConfirmAction>
  );
}
