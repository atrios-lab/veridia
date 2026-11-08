"use client";

import { useActionState } from "react";
import { ConfirmAction } from "../../../_components/confirm-action.tsx";
import { type DeleteState, deletePublicationAction } from "../actions.ts";

export function DeleteButton({
  id,
  title,
  redirectTo,
}: {
  id: string;
  title: string;
  /** Where to go once it is gone: the detail page has nothing left to show. */
  redirectTo?: string;
}) {
  const [state, formAction, pending] = useActionState<DeleteState, FormData>(
    deletePublicationAction,
    { status: "idle" },
  );

  return (
    <ConfirmAction
      action={formAction}
      pending={pending}
      error={state.status === "error" ? state.message : null}
      trigger="Excluir"
      question="Excluir esta publicação?"
      // Unlike archiving, nothing is kept: the operator has to know the
      // difference before the click, and that archiving is the other way.
      consequence={`"${title}" sai do site e do painel, junto com o arquivo anexado. Não dá para desfazer. Para só tirar do site e manter o registro, use "Arquivar agora".`}
      confirmLabel="Excluir de vez"
      pendingLabel="Excluindo…"
      className="flex-none"
    >
      <input type="hidden" name="id" value={id} />
      {redirectTo && (
        <input type="hidden" name="redirectTo" value={redirectTo} />
      )}
    </ConfirmAction>
  );
}
