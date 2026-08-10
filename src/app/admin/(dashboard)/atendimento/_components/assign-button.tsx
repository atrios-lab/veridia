"use client";

import { useActionState } from "react";
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
      <button
        type="submit"
        disabled={pending}
        className="btn btn-admin-primary btn-sm"
      >
        {pending ? "Atendendo…" : "Atender"}
      </button>
      {state.status === "error" && (
        <span className="text-[10.5px] font-semibold text-admin-error-text">
          {state.message}
        </span>
      )}
    </form>
  );
}
