"use client";

import { useActionState, useState } from "react";
import {
  type ActionState,
  respondManifestation,
  saveManifestationDraft,
} from "../actions.ts";

export function ReplySection({
  requestId,
  initialDraft,
}: {
  requestId: string;
  initialDraft: string;
}) {
  const [reply, setReply] = useState(initialDraft);
  const [respondState, respondAction, respondPending] = useActionState<
    ActionState,
    FormData
  >(respondManifestation, { status: "idle" });
  const [draftState, draftAction, draftPending] = useActionState<
    ActionState,
    FormData
  >(saveManifestationDraft, { status: "idle" });

  const pending = respondPending || draftPending;

  return (
    <div className="mt-5 border-t border-admin-border pt-4.5">
      <label
        htmlFor="reply"
        className="mb-2.5 block text-[13px] font-bold text-admin-primary"
      >
        Resposta ao cidadão
      </label>
      <textarea
        id="reply"
        rows={4}
        value={reply}
        onChange={(event) => setReply(event.target.value)}
        placeholder="Escreva a apuração e a resposta. Ela fica disponível na consulta pelo número de registro."
        className="w-full rounded-[10px] border border-admin-input-border bg-admin-input-bg px-3.5 py-3 text-[13.5px] text-admin-text placeholder:text-admin-faint"
      />

      <form action={respondAction} className="mt-3 flex items-center gap-2.5">
        <input type="hidden" name="requestId" value={requestId} />
        <input type="hidden" name="reply" value={reply} />
        <button
          type="submit"
          disabled={pending || !reply.trim()}
          className="btn btn-admin-primary btn-md"
        >
          {respondPending ? "Enviando…" : "Enviar resposta e concluir"}
        </button>
        <button
          type="submit"
          formAction={draftAction}
          disabled={pending}
          className="btn btn-admin-secondary btn-md"
        >
          {draftPending ? "Salvando…" : "Salvar rascunho"}
        </button>
      </form>

      {respondState.status === "error" && (
        <p
          role="alert"
          className="mt-2.5 text-[12.5px] font-semibold text-admin-error-text"
        >
          {respondState.message}
        </p>
      )}
      {draftState.status === "error" && (
        <p
          role="alert"
          className="mt-2.5 text-[12.5px] font-semibold text-admin-error-text"
        >
          {draftState.message}
        </p>
      )}
      {draftState.status === "success" && (
        <p className="mt-2.5 text-[12.5px] font-semibold text-admin-success-text">
          Rascunho salvo.
        </p>
      )}
    </div>
  );
}
