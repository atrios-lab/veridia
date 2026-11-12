"use client";

import { useActionState } from "react";
import { Button } from "../../../_ui/button.tsx";
import { type ActionState, assignConversationAction } from "../actions.ts";

export function AssignButton({ conversationId }: { conversationId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    assignConversationAction,
    { status: "idle" },
  );

  return (
    <form
      action={formAction}
      className="flex flex-none flex-col items-end gap-1"
    >
      <input type="hidden" name="conversationId" value={conversationId} />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Atendendo…" : "Atender"}
      </Button>
      {state.status === "error" && (
        <span className="text-xs font-medium text-destructive">
          {state.message}
        </span>
      )}
    </form>
  );
}
