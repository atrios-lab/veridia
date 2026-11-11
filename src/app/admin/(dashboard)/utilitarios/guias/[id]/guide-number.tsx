"use client";

import { useActionState } from "react";
import { ConfirmAction } from "../../../../_components/confirm-action.tsx";
import {
  type DeleteGuideState,
  deleteGuideAction,
  type GuideNumberState,
  renumberGuideAction,
} from "../actions.ts";

const FIELD =
  "w-full rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3 py-2 text-[13px] text-admin-text outline-none focus:border-admin-primary-soft";

/** The guia's number by hand, and "Excluir" for one issued by mistake. */
export function GuideNumber({
  id,
  year,
  sequence,
}: {
  id: string;
  year: number;
  sequence: number;
}) {
  const [state, action, pending] = useActionState<GuideNumberState, FormData>(
    renumberGuideAction,
    { status: "idle" },
  );
  const [deleteState, deleteAction, deleting] = useActionState<
    DeleteGuideState,
    FormData
  >(deleteGuideAction, { status: "idle" });

  return (
    <section className="flex flex-wrap items-end gap-3 rounded-[14px] border border-admin-border bg-admin-card px-5 py-4">
      <form action={action} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="id" value={id} />
        <label className="block w-[110px]">
          <span className="mb-1 block text-[11.5px] font-bold text-admin-primary">
            Nº de ordem
          </span>
          <input
            name="sequence"
            type="number"
            min={1}
            defaultValue={sequence}
            className={FIELD}
          />
        </label>
        <label className="block w-[100px]">
          <span className="mb-1 block text-[11.5px] font-bold text-admin-primary">
            Ano
          </span>
          <input
            name="year"
            type="number"
            min={2000}
            max={2100}
            defaultValue={year}
            className={FIELD}
          />
        </label>
        <label className="block w-[240px]">
          <span className="mb-1 block text-[11.5px] font-bold text-admin-primary">
            Motivo (vai para a auditoria)
          </span>
          <input
            name="justificativa"
            required
            placeholder="Ex.: seguir a numeração do livro"
            className={FIELD}
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="btn btn-admin-secondary btn-md"
        >
          {pending ? "Salvando…" : "Alterar número"}
        </button>
        {state.status !== "idle" && (
          <span
            role={state.status === "error" ? "alert" : undefined}
            className={`text-[12.5px] font-semibold ${state.status === "error" ? "text-admin-error-text" : "text-admin-success-text"}`}
          >
            {state.message}
          </span>
        )}
      </form>
      <div className="ml-auto">
        <ConfirmAction
          action={deleteAction}
          pending={deleting}
          error={deleteState.status === "error" ? deleteState.message : null}
          trigger="Excluir guia"
          question="Excluir esta guia?"
          consequence="Ela sai da lista e o número fica livre para a próxima. O registro continua guardado no sistema, com a auditoria."
          confirmLabel="Excluir guia"
          pendingLabel="Excluindo…"
        >
          <input type="hidden" name="id" value={id} />
        </ConfirmAction>
      </div>
    </section>
  );
}
