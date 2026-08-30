"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import {
  CHAT_AVAILABILITIES,
  CHAT_AVAILABILITY_LABELS,
  type ChatAvailability,
} from "@/core/chat/hours.ts";
import { type ActionState, toggleChatEnabledAction } from "../actions.ts";

/**
 * How the office is answering the chat, restricted to `chat.settings`: a
 * `staff` session sees the state, read-only, never the control.
 *
 * Three buttons rather than a switch: the office asked for "estou aqui agora"
 * and "abre sozinho no meu horário" from the same control, and a switch can
 * only ever say one of them. Which one is in force has to be readable at a
 * glance, so all three stay on screen with the current one marked.
 */
const HINTS: Record<ChatAvailability, string> = {
  on: "O chat abre agora, a qualquer hora e em qualquer dia.",
  auto: "O chat abre sozinho nos dias úteis, dentro do horário de atendimento.",
  off: "O botão do chat não aparece no site.",
};

export function ChatToggle({
  availability,
  canToggle,
}: {
  availability: ChatAvailability;
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
          availability === "off"
            ? "bg-admin-readonly-bg text-admin-muted"
            : "bg-admin-success-bg text-admin-success-text"
        }`}
      >
        {CHAT_AVAILABILITY_LABELS[availability]}
      </span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <form
        action={formAction}
        className="inline-flex rounded-full bg-admin-readonly-bg p-1"
      >
        {CHAT_AVAILABILITIES.map((option) => {
          const current = option === availability;
          return (
            <button
              key={option}
              type="submit"
              name="availability"
              value={option}
              disabled={pending}
              aria-pressed={current}
              className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold disabled:opacity-70 ${
                current
                  ? "bg-admin-card text-admin-primary shadow-sm"
                  : "text-admin-muted hover:text-admin-primary"
              }`}
            >
              {CHAT_AVAILABILITY_LABELS[option]}
            </button>
          );
        })}
      </form>
      <p className="text-[11.5px] text-admin-muted">
        {pending ? "Atualizando…" : HINTS[availability]}
      </p>
    </div>
  );
}
