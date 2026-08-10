"use client";

import { useActionState } from "react";
import { ConfirmAction } from "../../../_components/confirm-action.tsx";
import { type ArchiveState, archivePublicationAction } from "../actions.ts";

export function ArchiveButton({ id, title }: { id: string; title: string }) {
  const [state, formAction, pending] = useActionState<ArchiveState, FormData>(
    archivePublicationAction,
    { status: "idle" },
  );

  return (
    <ConfirmAction
      action={formAction}
      pending={pending}
      error={state.status === "error" ? state.message : null}
      trigger="Arquivar agora"
      question="Arquivar esta publicação?"
      // Nothing in the panel un-archives: `archivedAt` is only ever set, never
      // cleared. The operator has to know that before the click, not after.
      consequence={`"${title}" sai do site na hora, e não dá para republicar por aqui: só cadastrando de novo.`}
      confirmLabel="Confirmar arquivamento"
      pendingLabel="Arquivando…"
      className="flex-none"
    >
      <input type="hidden" name="id" value={id} />
    </ConfirmAction>
  );
}
