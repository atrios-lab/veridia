"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { toast } from "sonner";
import type { IntakeQuestion } from "@/core/dpo/intake.ts";
import { DocumentNameField } from "../../../../../_components/document-name-field.tsx";
import { Button } from "../../../../_ui/button.tsx";
import { Input } from "../../../../_ui/input.tsx";
import { Label } from "../../../../_ui/label.tsx";
import { Textarea } from "../../../../_ui/textarea.tsx";
import {
  type ActionState,
  answerIntakeAction,
  attachForTitularAction,
  type IntakeState,
} from "../actions.ts";

/**
 * The Assistente Virtual's questions before the draft (decision of
 * 15/11/2026), and a document for it to read (read and dropped).
 */
export function IntakeSection({
  requestId,
  questions,
  initial,
}: {
  requestId: string;
  questions: IntakeQuestion[];
  initial?: {
    answers: Record<string, { choice: string; note: string }>;
    notes: string;
    answeredAt?: string;
  };
}) {
  const [open, setOpen] = useState(!initial?.answeredAt);
  const [state, action, pending] = useActionState<IntakeState, FormData>(
    answerIntakeAction,
    { status: "idle" },
  );
  const id = useId();
  useEffect(() => {
    if (state.status === "saved") {
      toast.success(state.message);
      setOpen(false);
    }
  }, [state]);

  if (!open) {
    return (
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3.5 py-3 text-sm">
        <span className="text-foreground">
          Perguntas do Assistente Virtual respondidas.
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
        >
          Ver ou alterar as respostas
        </Button>
      </div>
    );
  }
  return (
    <form
      action={action}
      className="mt-5 flex flex-col gap-4 rounded-lg border border-primary/25 bg-primary/5 px-4 py-4"
    >
      <input type="hidden" name="requestId" value={requestId} />
      <div>
        <h3 className="text-sm font-semibold text-foreground">
          Antes de preparar a resposta, o Assistente Virtual pergunta
        </h3>
        <p className="mt-1 text-xs text-muted-foreground text-justify hyphens-auto">
          Responda com o que a serventia verificou. Com as respostas, ele
          prepara o rascunho da resposta ao titular. Não escreva nomes, CPF ou
          outros dados de pessoas nas observações; se escrever, são ocultados.
        </p>
      </div>
      {questions.map((q) => {
        const current = initial?.answers[q.id];
        return (
          <fieldset key={q.id} className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-foreground">
              {q.text}
            </legend>
            <div className="mt-1 flex flex-wrap gap-x-5 gap-y-2">
              {q.options.map((option) => (
                <label key={option} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name={`q-${q.id}`}
                    value={option}
                    defaultChecked={current?.choice === option}
                    required
                  />
                  {option}
                </label>
              ))}
            </div>
            {q.noteLabel && (
              <Input
                name={`n-${q.id}`}
                aria-label={q.noteLabel}
                placeholder={q.noteLabel}
                defaultValue={current?.note ?? ""}
                maxLength={1000}
              />
            )}
          </fieldset>
        );
      })}
      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor={`${id}-obs`}>
          Algo mais que ele deva saber (opcional)
        </Label>
        <Textarea
          id={`${id}-obs`}
          name="observacoes"
          rows={2}
          maxLength={4000}
          defaultValue={initial?.notes ?? ""}
        />
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor={`${id}-file`}>
          Documento para o Assistente Virtual considerar (opcional)
        </Label>
        <Input
          id={`${id}-file`}
          name="paraAssistente"
          type="file"
          multiple
          accept=".pdf,.docx,.odt,.rtf,.txt,.md"
        />
        <p className="text-xs text-muted-foreground">
          Lido na hora e descartado: não fica guardado nem vai ao titular. Dados
          como CPF e e-mail são ocultados antes da leitura.
        </p>
      </div>
      <div>
        <Button type="submit" disabled={pending}>
          {pending
            ? "Preparando o rascunho..."
            : "Responder e preparar o rascunho"}
        </Button>
      </div>
      {state.status === "error" && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {state.message}
        </p>
      )}
    </form>
  );
}

/** A document the office sends to the titular, shown in the consult. */
export function AttachForTitular({ requestId }: { requestId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    attachForTitularAction,
    { status: "idle" },
  );
  useEffect(() => {
    if (state.status === "success")
      toast.success("Documento enviado ao titular.");
  }, [state]);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="requestId" value={requestId} />
      <DocumentNameField
        field="paraTitular"
        tone="admin"
        suggestions={[
          "Declaração de dados pessoais",
          "Cópia dos dados",
          "Comprovante de correção",
          "Comprovante de eliminação",
          "Pedido de complemento",
        ]}
        placeholder="Nome do documento"
      />
      <label className="relative flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-dashed border-input px-4 py-3 text-center transition-colors hover:bg-muted/50 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
        <span className="text-sm font-medium text-primary">
          Escolher arquivo para o titular
        </span>
        <input
          type="file"
          name="paraTitular"
          accept="application/pdf,image/jpeg,image/png,image/webp,image/heic"
          className="sr-only"
        />
      </label>
      <div>
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? "Enviando..." : "Enviar ao titular"}
        </Button>
      </div>
      {state.status === "error" && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {state.message}
        </p>
      )}
    </form>
  );
}
