"use client";

import { useActionState } from "react";
import { ConfirmAction } from "../../../../../_components/confirm-action.tsx";
import { type CohortDeleteState, deleteCohortAction } from "../actions.ts";

/**
 * ⚠️ "Excluir turma", offered only while nobody joined it (decision of
 * 16/11/2026): for a cohort made by mistake, for a test or twice. With
 * participants the screen says why not, and the server refuses all the
 * same.
 */
export function CohortDelete({
  cohortId,
  officeName,
  members,
}: {
  cohortId: string;
  officeName: string;
  members: number;
}) {
  const [state, formAction, pending] = useActionState<
    CohortDeleteState,
    FormData
  >(deleteCohortAction.bind(null, cohortId), { status: "idle" });

  if (members > 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Esta turma tem {members}{" "}
        {members === 1 ? "participante" : "participantes"} e não pode ser
        excluída: as contas, o progresso e os certificados dependem dela. Para
        parar o link, use <strong>Encerrar inscrições</strong>.
      </p>
    );
  }

  return (
    <ConfirmAction
      action={formAction}
      pending={pending}
      error={state.status === "error" ? state.message : null}
      trigger="Excluir turma"
      question={`Excluir a turma de ${officeName}?`}
      consequence="Ninguém entrou por ela ainda. A turma sai da lista e o link para de funcionar na hora; quem tentar abrir verá que o link não existe. Não dá para desfazer."
      confirmLabel="Excluir turma"
      pendingLabel="Excluindo…"
    />
  );
}
