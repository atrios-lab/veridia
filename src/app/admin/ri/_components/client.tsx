"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "../../_components/confirm-action.tsx";
import { Button } from "../../_ui/button.tsx";
import type { RiState } from "../actions.ts";

const IDLE: RiState = { status: "idle" };

export function useRiToast(state: RiState) {
  const last = useRef(state);
  useEffect(() => {
    if (state === last.current) return;
    last.current = state;
    if (state.status === "success") toast.success(state.message);
    if (state.status === "error") toast.error(state.message);
  }, [state]);
}

type Action = (previous: RiState, formData: FormData) => Promise<RiState>;

/** A button that posts hidden fields to an action, with its toast. */
export function ActionButton({
  action,
  fields,
  label,
  pendingLabel,
  variant = "outline",
}: {
  action: Action;
  fields: Record<string, string>;
  label: string;
  pendingLabel: string;
  variant?: "outline" | "default" | "secondary";
}) {
  const [state, dispatch, pending] = useActionState(action, IDLE);
  useRiToast(state);
  return (
    <form action={dispatch}>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <Button type="submit" size="sm" variant={variant} disabled={pending}>
        {pending ? pendingLabel : label}
      </Button>
    </form>
  );
}

/** "Apagar" (or "Restaurar") with the confirmation and the justification. */
export function ConfirmButton({
  action,
  fields,
  trigger,
  question,
  consequence,
  confirmLabel,
  pendingLabel,
  destructive = true,
}: {
  action: Action;
  fields: Record<string, string>;
  trigger: string;
  question: string;
  consequence: string;
  confirmLabel: string;
  pendingLabel: string;
  destructive?: boolean;
}) {
  const [state, dispatch, pending] = useActionState(action, IDLE);
  useRiToast(state);
  return (
    <ConfirmAction
      action={dispatch}
      pending={pending}
      error={state.status === "error" ? state.message : null}
      trigger={trigger}
      question={question}
      consequence={consequence}
      confirmLabel={confirmLabel}
      pendingLabel={pendingLabel}
      {...(destructive
        ? {}
        : {
            triggerClassName:
              "inline-flex h-8 items-center rounded-md border bg-background px-3 text-sm font-medium shadow-xs hover:bg-muted",
          })}
    >
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
    </ConfirmAction>
  );
}
