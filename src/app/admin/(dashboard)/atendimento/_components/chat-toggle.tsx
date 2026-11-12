"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import {
  CHAT_AVAILABILITIES,
  CHAT_AVAILABILITY_LABELS,
  type ChatAvailability,
} from "@/core/chat/hours.ts";
import { cn } from "../../../_ui/cn.ts";
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
        className={cn(
          "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium",
          availability === "off"
            ? "bg-muted text-muted-foreground"
            : "bg-success text-success-foreground",
        )}
      >
        {CHAT_AVAILABILITY_LABELS[availability]}
      </span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <form action={formAction} className="inline-flex rounded-lg bg-muted p-1">
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
              className={cn(
                "rounded-md px-3 py-1 text-sm font-medium transition-colors disabled:opacity-70",
                current
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {CHAT_AVAILABILITY_LABELS[option]}
            </button>
          );
        })}
      </form>
      <p className="text-xs text-muted-foreground">
        {pending ? "Atualizando…" : HINTS[availability]}
      </p>
    </div>
  );
}
