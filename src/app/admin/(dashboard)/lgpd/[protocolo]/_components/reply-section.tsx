"use client";

import { useActionState, useState } from "react";
import { DocumentNameField } from "../../../../../_components/document-name-field.tsx";
import { useEmailWarning } from "../../../../_components/use-email-warning.ts";
import { Button } from "../../../../_ui/button.tsx";
import { Label } from "../../../../_ui/label.tsx";
import { Textarea } from "../../../../_ui/textarea.tsx";
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
  useEmailWarning(respondState);

  const pending = respondPending || draftPending;

  return (
    <div className="mt-5 border-t pt-4">
      <Label htmlFor="reply" className="mb-2.5">
        Resposta ao titular
      </Label>
      <Textarea
        id="reply"
        rows={4}
        value={reply}
        onChange={(event) => setReply(event.target.value)}
        placeholder="Escreva a resposta. Ela chega ao titular pela consulta com chave, como qualquer pedido."
        className="field-sizing-fixed bg-background"
      />

      <form action={respondAction} className="mt-2.5">
        <input type="hidden" name="requestId" value={requestId} />
        <input type="hidden" name="reply" value={reply} />
        <div className="mb-2.5">
          <DocumentNameField
            field="relatorio"
            tone="admin"
            suggestions={[
              "Relatório de dados pessoais",
              "Resposta ao titular",
              "Cópia dos dados",
              "Comprovante de correção",
              "Comprovante de eliminação",
            ]}
            placeholder="Relatório de dados"
          />
        </div>
        <label className="relative mt-1 flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-dashed border-input px-4 py-3.5 text-center transition-colors hover:bg-muted/50 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
          <span className="text-sm font-medium text-primary">
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
          <Button type="submit" disabled={pending || !reply.trim()}>
            {respondPending ? "Enviando…" : "Enviar resposta e concluir"}
          </Button>
          <Button
            type="submit"
            variant="outline"
            formAction={draftAction}
            disabled={pending}
          >
            {draftPending ? "Salvando…" : "Salvar rascunho"}
          </Button>
        </div>
      </form>

      {respondState.status === "error" && (
        <p role="alert" className="mt-2.5 text-sm font-medium text-destructive">
          {respondState.message}
        </p>
      )}
      {draftState.status === "error" && (
        <p role="alert" className="mt-2.5 text-sm font-medium text-destructive">
          {draftState.message}
        </p>
      )}
      {draftState.status === "success" && (
        <p className="mt-2.5 text-sm font-medium text-success-text">
          Rascunho salvo.
        </p>
      )}
    </div>
  );
}
