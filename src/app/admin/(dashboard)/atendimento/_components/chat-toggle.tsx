"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { type ActionState, toggleChatEnabledAction } from "../actions.ts";

/**
 * "Disponível para o chat", restricted to `chat.settings`: a `staff`
 * session sees the same pill `AdminPageHeader` already shows everywhere,
 * read-only, never the switch (see admin-support-chat spec, "Sem a
 * permissão").
 */
export function ChatToggle({
  enabled,
  canToggle,
}: {
  enabled: boolean;
  canToggle: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    toggleChatEnabledAction,
    { status: "idle" },
  );

  useEffect(() => {
    if (state.status === "error") toast.error(state.message);
  }, [state]);

  if (!canToggle) {
    return (
      <span
        className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold ${
          enabled
            ? "bg-admin-success-bg text-admin-success-text"
            : "bg-admin-readonly-bg text-admin-muted"
        }`}
      >
        {enabled ? "Disponível para o chat" : "Indisponível para o chat"}
      </span>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="enabled" value={enabled ? "off" : "on"} />
      <button
        type="submit"
        disabled={pending}
        className={`inline-flex items-center gap-2.5 rounded-full py-1.5 pr-2 pl-3.5 text-[12.5px] font-semibold disabled:opacity-70 ${
          enabled
            ? "bg-admin-success-bg text-admin-success-text"
            : "bg-admin-readonly-bg text-admin-muted"
        }`}
      >
        {pending
          ? "Atualizando…"
          : enabled
            ? "Disponível para o chat"
            : "Indisponível para o chat"}
        <span
          aria-hidden="true"
          className={`relative inline-block h-5 w-8.5 rounded-full ${
            enabled ? "bg-admin-success-text" : "bg-admin-input-border"
          }`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
              enabled ? "right-0.5" : "left-0.5"
            }`}
          />
        </span>
      </button>
    </form>
  );
}
