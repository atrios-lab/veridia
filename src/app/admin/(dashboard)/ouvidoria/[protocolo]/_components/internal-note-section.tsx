"use client";

import { useActionState, useState } from "react";
import { AdminIcon } from "../../../../_components/icon.tsx";
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
    <div className="mt-5 border-t border-admin-border pt-4.5">
      <div className="flex items-start gap-2.5 rounded-[11px] border border-admin-border bg-admin-warning-bg px-3.5 py-3">
        <AdminIcon
          name="clock"
          className="mt-0.5 h-3.5 w-3.5 flex-none text-admin-warning-text"
          strokeWidth={1.9}
        />
        <p className="text-[12.5px] leading-relaxed text-admin-warning-text">
          Sem nome nem contato informado: não há como enviar resposta a quem
          manifestou. Só é possível deixar uma nota interna para a equipe.
        </p>
      </div>

      <label
        htmlFor="note"
        className="mt-3.5 mb-2 block text-[13px] font-bold text-admin-primary"
      >
        Anotação interna
      </label>
      <textarea
        id="note"
        rows={3}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Não é enviada a ninguém."
        className="w-full rounded-[10px] border border-admin-input-border bg-admin-input-bg px-3.5 py-3 text-[13.5px] text-admin-text placeholder:text-admin-faint"
      />

      <form action={action} className="mt-3">
        <input type="hidden" name="requestId" value={requestId} />
        <input type="hidden" name="note" value={note} />
        <button
          type="submit"
          disabled={pending}
          className="btn btn-admin-primary btn-md"
        >
          {pending ? "Salvando…" : "Salvar anotação"}
        </button>
      </form>

      {state.status === "error" && (
        <p
          role="alert"
          className="mt-2.5 text-[12.5px] font-semibold text-admin-error-text"
        >
          {state.message}
        </p>
      )}
      {state.status === "success" && (
        <p className="mt-2.5 text-[12.5px] font-semibold text-admin-success-text">
          Anotação salva.
        </p>
      )}
    </div>
  );
}
