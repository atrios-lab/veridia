"use client";

import { useActionState, useState } from "react";
import { useEmailWarning } from "../../../../_components/use-email-warning.ts";
import { Button } from "../../../../_ui/button.tsx";
import { Label } from "../../../../_ui/label.tsx";
import { Textarea } from "../../../../_ui/textarea.tsx";
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
  useEmailWarning(respondState);

  const pending = respondPending || draftPending;

  return (
    <div className="mt-5 border-t pt-4">
      <Label htmlFor="reply" className="mb-2.5">
        Resposta ao cidadão
      </Label>
      <Textarea
        id="reply"
        rows={4}
        value={reply}
        onChange={(event) => setReply(event.target.value)}
        placeholder="Escreva a apuração e a resposta. Ela fica disponível na consulta pelo número de registro."
        className="field-sizing-fixed bg-background"
      />

      <form action={respondAction} className="mt-3 flex items-center gap-2.5">
        <input type="hidden" name="requestId" value={requestId} />
        <input type="hidden" name="reply" value={reply} />
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
