"use client";

import { useActionState, useEffect, useState } from "react";
import { FilePicker } from "@/app/admin/_components/file-picker.tsx";
import { DocumentNameField } from "../../../../../_components/document-name-field.tsx";
import { useEmailWarning } from "../../../../_components/use-email-warning.ts";
import { Button } from "../../../../_ui/button.tsx";
import { Label } from "../../../../_ui/label.tsx";
import { Textarea } from "../../../../_ui/textarea.tsx";
import {
  type ActionState,
  type DraftState,
  draftDataRightsReply,
  respondDataRights,
  saveDataRightsDraft,
} from "../actions.ts";

/**
 * "Rascunhar resposta" with the DPO assistant (change assistente-do-dpo).
 * Only the right asked and the optional note leave for the model; the
 * holder's data is filled in by the platform. A reply already written is
 * replaced only after the person says so.
 */
function AssistantDraft({
  requestId,
  current,
  onDraft,
}: {
  requestId: string;
  current: string;
  onDraft: (draft: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [pendingDraft, setPendingDraft] = useState<string | null>(null);
  const [state, action, pending] = useActionState<DraftState, FormData>(
    draftDataRightsReply,
    { status: "idle" },
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: react to a new result only
  useEffect(() => {
    if (state.status !== "ok") return;
    if (current.trim()) setPendingDraft(state.draft);
    else {
      onDraft(state.draft);
      setOpen(false);
    }
  }, [state]);

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mb-2.5"
        onClick={() => setOpen(true)}
      >
        Rascunhar resposta com o assistente do DPO
      </Button>
    );
  }

  return (
    <div className="mb-3 flex flex-col gap-2 rounded-lg border bg-muted/40 p-3">
      <form action={action} className="flex flex-col gap-2">
        <input type="hidden" name="requestId" value={requestId} />
        <Label htmlFor="dpo-note" className="text-xs">
          Observação para o assistente (opcional)
        </Label>
        <Textarea
          id="dpo-note"
          name="note"
          rows={2}
          maxLength={4000}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Ex.: os dados pedidos estão em registro de nascimento"
          className="field-sizing-fixed bg-background"
        />
        <p className="text-xs text-muted-foreground">
          Ao assistente vão o pedido escrito pelo titular, a conversa e esta
          observação. O nome, o protocolo e as datas a plataforma preenche: a
          resposta sai completa.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Gerando rascunho…" : "Gerar rascunho"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setOpen(false)}
          >
            Cancelar
          </Button>
        </div>
      </form>
      {state.status === "error" && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {state.message}
        </p>
      )}
      {pendingDraft && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-card p-2.5 text-sm">
          <span>Substituir o texto atual da resposta pelo rascunho?</span>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              onDraft(pendingDraft);
              setPendingDraft(null);
              setOpen(false);
            }}
          >
            Substituir
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setPendingDraft(null)}
          >
            Manter o texto
          </Button>
        </div>
      )}
    </div>
  );
}

export function ReplySection({
  requestId,
  initialDraft,
  canDraft = false,
}: {
  requestId: string;
  initialDraft: string;
  /** Whether the DPO assistant's draft is offered (`dpo.assist`). */
  canDraft?: boolean;
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
      {canDraft && (
        <AssistantDraft
          requestId={requestId}
          current={reply}
          onDraft={setReply}
        />
      )}
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
        <div className="mt-1">
          <FilePicker
            name="relatorio"
            accept="application/pdf,image/jpeg,image/png,image/webp,image/heic"
            label="Anexar relatório de dados (opcional)"
          />
        </div>

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
