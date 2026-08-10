"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  label,
  pendingLabel,
  blocked = false,
  blockedLabel,
}: {
  /** Idle text, e.g. "Entrar". */
  label: string;
  /** Text while the form action is running, e.g. "Entrando…". */
  pendingLabel: string;
  /** An external reason to disable the button before it is even submitted,
   * e.g. login's rate limit. Takes priority over the pending state. */
  blocked?: boolean;
  /** Text to show while `blocked` is true. Required when `blocked` can. */
  blockedLabel?: string;
}) {
  const { pending } = useFormStatus();
  const disabled = blocked || pending;
  const text = blocked
    ? (blockedLabel ?? label)
    : pending
      ? pendingLabel
      : label;

  return (
    <button
      type="submit"
      disabled={disabled}
      className="btn btn-admin-primary btn-lg mt-1"
    >
      {text}
    </button>
  );
}
