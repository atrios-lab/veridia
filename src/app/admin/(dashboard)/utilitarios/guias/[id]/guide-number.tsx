"use client";

import { useActionState } from "react";
import { ConfirmAction } from "../../../../_components/confirm-action.tsx";
import { Button } from "../../../../_ui/button.tsx";
import { Input } from "../../../../_ui/input.tsx";
import { Label } from "../../../../_ui/label.tsx";
import {
  type DeleteGuideState,
  deleteGuideAction,
  type GuideNumberState,
  renumberGuideAction,
} from "../actions.ts";

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
    <section className="flex flex-wrap items-end gap-3 rounded-xl border bg-card px-5 py-4">
      <form action={action} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="id" value={id} />
        <Label className="block w-[110px] leading-normal font-normal">
          <span className="mb-1.5 block text-sm font-medium text-foreground">
            Nº de ordem
          </span>
          <Input
            name="sequence"
            type="number"
            min={1}
            defaultValue={sequence}
          />
        </Label>
        <Label className="block w-[100px] leading-normal font-normal">
          <span className="mb-1.5 block text-sm font-medium text-foreground">
            Ano
          </span>
          <Input
            name="year"
            type="number"
            min={2000}
            max={2100}
            defaultValue={year}
          />
        </Label>
        <Label className="block w-[240px] leading-normal font-normal">
          <span className="mb-1.5 block text-sm font-medium text-foreground">
            Motivo (vai para a auditoria)
          </span>
          <Input
            name="justificativa"
            required
            placeholder="Ex.: seguir a numeração do livro"
          />
        </Label>
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Salvando…" : "Alterar número"}
        </Button>
        {state.status !== "idle" && (
          <span
            role={state.status === "error" ? "alert" : undefined}
            className={`text-xs font-semibold ${state.status === "error" ? "text-destructive" : "text-success-text"}`}
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
