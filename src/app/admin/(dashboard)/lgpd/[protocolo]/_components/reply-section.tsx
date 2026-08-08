"use client";

import { useActionState, useState } from "react";
import {
  type ActionState,
  respondDataRights,
  saveDataRightsDraft,
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
  >(respondDataRights, { status: "idle" });
  const [draftState, draftAction, draftPending] = useActionState<
    ActionState,
    FormData
  >(saveDataRightsDraft, { status: "idle" });

  const pending = respondPending || draftPending;

  return (
    <div className="mt-5 border-t border-admin-border pt-4.5">
      <label
        htmlFor="reply"
        className="mb-2.5 block text-[13px] font-bold text-admin-primary"
      >
        Resposta ao titular
      </label>
      <textarea
        id="reply"
        rows={4}
        value={reply}
        onChange={(event) => setReply(event.target.value)}
        placeholder="Escreva a resposta. Ela chega ao titular pela consulta com chave, como qualquer pedido."
        className="w-full rounded-[10px] border border-admin-input-border bg-admin-input-bg px-3.5 py-3 text-[13.5px] text-admin-text placeholder:text-admin-faint"
      />

      <form action={respondAction} className="mt-2.5">
        <input type="hidden" name="requestId" value={requestId} />
        <input type="hidden" name="reply" value={reply} />
        <label className="mt-1 flex cursor-pointer flex-col items-center gap-1 rounded-[10px] border-[1.5px] border-dashed border-admin-input-border px-4 py-3.5 text-center">
          <span className="text-[12.5px] font-semibold text-admin-primary">
            Anexar relatório de dados (opcional)
          </span>
          <input
            type="file"
            name="relatorio"
            accept="application/pdf,image/jpeg,image/png,image/webp,image/heic"
            className="sr-only"
          />
        </label>

        <div className="mt-3 flex items-center gap-2.5">
          <button
            type="submit"
            disabled={pending || !reply.trim()}
            className="rounded-[9px] bg-admin-primary-soft px-4.5 py-2.5 text-[13px] font-bold text-white disabled:opacity-60"
          >
            {respondPending ? "Enviando…" : "Enviar resposta e concluir"}
          </button>
          <button
            type="submit"
            formAction={draftAction}
            disabled={pending}
            className="rounded-[9px] border border-admin-input-border px-4 py-2.5 text-[12.5px] font-bold text-admin-muted disabled:opacity-60"
          >
            {draftPending ? "Salvando…" : "Salvar rascunho"}
          </button>
        </div>
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
