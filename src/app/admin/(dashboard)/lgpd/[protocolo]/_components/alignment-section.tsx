"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { segmentAnswer } from "@/core/dpo/citations.ts";
import type { SourceView } from "@/lib/dpo/assistant.ts";
import { DocumentNameField } from "../../../../../_components/document-name-field.tsx";
import { Button } from "../../../../_ui/button.tsx";
import { Label } from "../../../../_ui/label.tsx";
import { Textarea } from "../../../../_ui/textarea.tsx";
import {
  type ActionState,
  type AlignState,
  alignAction,
  approveReplyAction,
  attachForTitularAction,
  prepareFromAlignmentAction,
} from "../actions.ts";

export interface AlignmentMessageView {
  id: string;
  role: "user" | "assistant" | "refusal";
  content: string;
  sources: SourceView[];
  atLabel: string;
}

function AnswerText({
  text,
  sources,
}: {
  text: string;
  sources: SourceView[];
}) {
  return (
    <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
      {segmentAnswer(text).map((segment, i) => {
        if (segment.kind === "text") return segment.text;
        const source = sources.find((s) => s.id === segment.id);
        return source ? (
          <span
            key={`${segment.id}-${i}`}
            className="mx-0.5 inline rounded bg-secondary px-1.5 py-0.5 text-xs font-medium text-secondary-foreground"
          >
            {source.citation}
          </span>
        ) : null;
      })}
    </p>
  );
}

function Sources({ sources }: { sources: SourceView[] }) {
  if (sources.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5 border-t pt-2.5">
      <span className="text-xs text-muted-foreground">
        Onde está na lei (toque para ler o texto):
      </span>
      {sources.map((source) => (
        <details
          key={source.id}
          className="rounded-md bg-muted/50 px-2.5 py-1.5"
        >
          <summary className="cursor-pointer text-xs font-medium text-foreground">
            {source.citation} · {source.sourceName}
            {source.guidance ? " (orientação, não é norma)" : ""}
          </summary>
          <p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground text-justify hyphens-auto">
            {source.text}
          </p>
        </details>
      ))}
    </div>
  );
}

/**
 * The conversation on the requerimento (decision of 15/11/2026): the
 * Assistente Virtual looks up the law and says what the office may keep,
 * give, correct or delete, asks what it needs, and the team answers until
 * the answer is aligned. The final decision is the encarregado's or the
 * Tabelião's, below.
 */
export function AlignmentSection({
  requestId,
  messages,
}: {
  requestId: string;
  messages: AlignmentMessageView[];
}) {
  const [state, action, pending] = useActionState<AlignState, FormData>(
    alignAction,
    { status: "idle" },
  );
  const [prepState, prepAction, preparing] = useActionState<
    AlignState,
    FormData
  >(prepareFromAlignmentAction, { status: "idle" });
  const [text, setText] = useState("");
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status === "ok") {
      setText("");
      form.current?.reset();
    }
  }, [state]);
  useEffect(() => {
    if (prepState.status === "ok")
      toast.success(
        "Resposta preparada no campo abaixo. Revise antes de pedir a aprovação.",
      );
  }, [prepState]);
  const started = messages.length > 0;

  return (
    <div className="mt-5 flex flex-col gap-3 rounded-lg border px-3.5 py-3">
      <div>
        <span className="text-sm font-medium text-foreground">
          Conversa com o Assistente Virtual
        </span>
        <p className="mt-1 text-xs text-muted-foreground text-justify hyphens-auto">
          O Assistente Virtual pesquisa na lei e nas normas o que vale para este
          pedido: o que a serventia pode guardar e por quê, o que precisa
          entregar, corrigir ou apagar. Ele pergunta o que precisa saber e vocês
          alinham a resposta. A decisão final é do encarregado de dados ou do
          Tabelião. O pedido escrito pelo titular vai ao Assistente Virtual,
          para a resposta sair completa; o nome, o protocolo e as datas a
          plataforma preenche. O que a equipe escreve aqui tem CPF, RG,
          matrícula, e-mail, telefone, endereço e nascimento trocados por
          marcadores; nomes não são reconhecidos, então não escreva nomes de
          outras pessoas. A conversa fica guardada neste requerimento.
        </p>
      </div>

      {messages.map((m) =>
        m.role === "user" ? (
          <div
            key={m.id}
            className="ml-6 rounded-xl bg-primary/5 px-3.5 py-2.5 text-sm text-foreground"
          >
            <span className="mb-1 block text-xs text-muted-foreground">
              Equipe · {m.atLabel}
            </span>
            <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">
              {m.content}
            </p>
          </div>
        ) : (
          <div
            key={m.id}
            className="mr-6 flex flex-col gap-2 rounded-xl border bg-card px-3.5 py-2.5 shadow-xs"
          >
            <span className="text-xs text-muted-foreground">
              Assistente Virtual · {m.atLabel}
            </span>
            <AnswerText text={m.content} sources={m.sources} />
            <Sources sources={m.sources} />
          </div>
        ),
      )}

      <form ref={form} action={action} className="flex flex-col gap-2">
        <input type="hidden" name="requestId" value={requestId} />
        {started ? (
          <>
            <Label htmlFor="align-message" className="text-xs">
              Sua resposta ou pergunta ao Assistente Virtual
            </Label>
            <Textarea
              id="align-message"
              name="message"
              rows={3}
              maxLength={4000}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Ex.: os dados estão no livro de nascimento e também no cadastro de contato do site."
              className="field-sizing-fixed bg-background"
            />
          </>
        ) : (
          <p className="text-xs text-muted-foreground text-justify hyphens-auto">
            Comece pela análise: o Assistente Virtual lê o tipo do pedido,
            pesquisa a lei e traz as primeiras perguntas.
          </p>
        )}
        <label className="relative flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-input px-3 py-2 text-xs transition-colors hover:bg-muted/50 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
          <span className="font-medium text-primary">
            Anexar documento para o Assistente Virtual ler (opcional)
          </span>
          <span className="text-muted-foreground">
            lido e descartado, não fica guardado
          </span>
          <input
            type="file"
            name="paraAssistente"
            multiple
            accept="application/pdf,image/jpeg,image/png,image/webp,.docx,.txt"
            className="sr-only"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            size="sm"
            disabled={pending || (started && !text.trim())}
          >
            {pending
              ? "O Assistente Virtual está pesquisando…"
              : started
                ? "Enviar"
                : "Começar a análise"}
          </Button>
        </div>
        {state.status === "error" && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {state.message}
          </p>
        )}
      </form>

      {started && (
        <form
          action={prepAction}
          className="flex flex-col gap-1.5 border-t pt-3"
        >
          <input type="hidden" name="requestId" value={requestId} />
          <div>
            <Button
              type="submit"
              size="sm"
              variant="outline"
              disabled={preparing}
            >
              {preparing
                ? "Preparando a resposta…"
                : "Preparar a resposta com o que alinhamos"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            O texto vai para o campo da resposta. Nada é enviado ao titular sem
            a aprovação do encarregado ou do Tabelião.
          </p>
          {prepState.status === "error" && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {prepState.message}
            </p>
          )}
        </form>
      )}
    </div>
  );
}

/**
 * The final decision on the answer (`lgpd.decide`): who approved, or what
 * is missing, and the approval button for the encarregado and the
 * Tabelião.
 */
export function ApprovalBlock({
  requestId,
  status,
  approvedBy,
  canDecide,
  hasDraft,
}: {
  requestId: string;
  status: "pending" | "approved" | "changed";
  approvedBy: string | null;
  canDecide: boolean;
  hasDraft: boolean;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    approveReplyAction,
    { status: "idle" },
  );
  const tone =
    status === "approved"
      ? "border-success/30 bg-success-soft text-success-text"
      : "border-warning/30 bg-warning-soft text-warning-text";
  return (
    <div
      className={`mt-5 flex flex-col gap-2 rounded-lg border px-3.5 py-3 ${tone}`}
    >
      <span className="text-sm font-medium">Decisão final</span>
      <p className="text-xs text-justify hyphens-auto">
        {status === "approved"
          ? `Resposta aprovada por ${approvedBy}. Ela já pode ser enviada ao titular.`
          : status === "changed"
            ? `O texto mudou depois da aprovação de ${approvedBy}. Precisa ser aprovado de novo antes de ir ao titular.`
            : "A resposta ainda não foi aprovada. Só o encarregado de dados ou o Tabelião decidem o que vai ao titular."}
      </p>
      {canDecide && status !== "approved" && (
        <form action={action} className="flex flex-col gap-1.5">
          <input type="hidden" name="requestId" value={requestId} />
          <div>
            <Button type="submit" size="sm" disabled={pending || !hasDraft}>
              {pending ? "Aprovando…" : "Aprovar a resposta salva"}
            </Button>
          </div>
          <p className="text-xs">
            Aprova o texto como foi salvo por último no rascunho.
          </p>
          {state.status === "error" && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {state.message}
            </p>
          )}
        </form>
      )}
    </div>
  );
}

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
