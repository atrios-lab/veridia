"use client";

import { useActionState, useState } from "react";
import { AdminIcon } from "../../../../_components/icon.tsx";
import { Button } from "../../../../_ui/button.tsx";
import { Label } from "../../../../_ui/label.tsx";
import { Textarea } from "../../../../_ui/textarea.tsx";
import { type ActionState, saveInternalNote } from "../actions.ts";

/**
 * The manifestation has no name and no contact: there is nobody to send a
 * reply to, so this offers only an internal note. Never a resend of the same
 * form with the button removed: the copy above it says outright why there
 * is no way to answer, instead of a form that quietly does nothing.
 */
export function InternalNoteSection({
  requestId,
  initialNote,
}: {
  requestId: string;
  initialNote: string;
}) {
  const [note, setNote] = useState(initialNote);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    saveInternalNote,
    { status: "idle" },
  );

  return (
    <div className="mt-5 border-t pt-4">
      <div className="flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3">
        <AdminIcon
          name="clock"
          className="mt-0.5 h-3.5 w-3.5 flex-none text-warning-text"
          strokeWidth={1.9}
        />
        <p className="text-xs leading-relaxed text-warning-text">
          Sem nome nem contato informado: não há como enviar resposta a quem
          manifestou. Só é possível deixar uma nota interna para a equipe.
        </p>
      </div>

      <Label htmlFor="note" className="mt-4 mb-2">
        Anotação interna
      </Label>
      <Textarea
        id="note"
        rows={3}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Não é enviada a ninguém."
        className="field-sizing-fixed bg-background"
      />

      <form action={action} className="mt-3">
        <input type="hidden" name="requestId" value={requestId} />
        <input type="hidden" name="note" value={note} />
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : "Salvar anotação"}
        </Button>
      </form>

      {state.status === "error" && (
        <p role="alert" className="mt-2.5 text-sm font-medium text-destructive">
          {state.message}
        </p>
      )}
      {state.status === "success" && (
        <p className="mt-2.5 text-sm font-medium text-success-text">
          Anotação salva.
        </p>
      )}
    </div>
  );
}
