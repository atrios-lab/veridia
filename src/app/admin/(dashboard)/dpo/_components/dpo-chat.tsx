"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { segmentAnswer } from "@/core/dpo/citations.ts";
import { DPO_COPY } from "@/core/dpo/copy.ts";
import type { DpoEvent, SourceView } from "@/lib/dpo/assistant.ts";
import { SignOrPrint } from "../../../_components/sign-or-print.tsx";
import { Button, buttonVariants } from "../../../_ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../_ui/dialog.tsx";
import { Label } from "../../../_ui/label.tsx";
import { Textarea } from "../../../_ui/textarea.tsx";

export interface ChatMessage {
  /** The stored answer's id: the document's download reads it. */
  id?: string;
  role: "user" | "assistant" | "refusal" | "error";
  content: string;
  maskedNotice?: string;
  sources?: SourceView[];
  noSource?: boolean;
  /** While the answer still streams: markers not resolved yet. */
  pending?: boolean;
}

const MAX_LENGTH = 4000;

/** The part after a line with only "---": the drafted document. */
function splitDocument(text: string): { answer: string; document: string } {
  const match = text.match(/\n-{3,}\s*\n/);
  if (!match || match.index === undefined)
    return { answer: text, document: "" };
  return {
    answer: text.slice(0, match.index).trim(),
    document: text.slice(match.index + match[0].length).trim(),
  };
}

function AnswerText({
  text,
  sources,
  pending,
  onSource,
}: {
  text: string;
  sources: SourceView[];
  pending: boolean;
  onSource: (source: SourceView) => void;
}) {
  return (
    <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
      {segmentAnswer(text).map((segment, i) => {
        if (segment.kind === "text") return segment.text;
        const source = sources.find((s) => s.id === segment.id);
        if (!source) {
          // Still streaming, or a citation the platform did not accept.
          return pending ? (
            <span key={`${segment.id}-${i}`} className="text-muted-foreground">
              {" "}
              [fonte]
            </span>
          ) : null;
        }
        return (
          <button
            key={`${segment.id}-${i}`}
            type="button"
            onClick={() => onSource(source)}
            className="mx-0.5 inline rounded bg-secondary px-1.5 py-0.5 text-xs font-medium text-secondary-foreground underline-offset-2 hover:underline"
          >
            {source.citation}
          </button>
        );
      })}
    </p>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? "Copiado" : "Copiar"}
    </Button>
  );
}

function AssistantMessage({
  message,
  onSource,
}: {
  message: ChatMessage;
  onSource: (source: SourceView) => void;
}) {
  const sources = message.sources ?? [];
  const { answer, document } = splitDocument(message.content);
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-xs">
      {answer && (
        <AnswerText
          text={answer}
          sources={sources}
          pending={Boolean(message.pending)}
          onSource={onSource}
        />
      )}
      {document && (
        <div className="rounded-lg border bg-muted/40 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Documento pronto
            </span>
            {!message.pending && (
              <div className="flex flex-wrap items-center gap-2">
                {message.id && (
                  <>
                    <SignOrPrint
                      pdfHref={`/admin/dpo/documento/${message.id}`}
                      title="Documento do encarregado de dados"
                      size="sm"
                    />
                    <a
                      href={`/admin/dpo/documento/${message.id}/word`}
                      className={buttonVariants({
                        variant: "outline",
                        size: "sm",
                      })}
                    >
                      Baixar Word
                    </a>
                  </>
                )}
                <CopyButton text={document} />
              </div>
            )}
          </div>
          <AnswerText
            text={document}
            sources={sources}
            pending={Boolean(message.pending)}
            onSource={onSource}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            {DPO_COPY.notAdvice}
          </p>
        </div>
      )}
      {!message.pending && sources.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-t pt-3">
          <span className="text-xs text-muted-foreground">Fontes:</span>
          {sources.map((source) => (
            <button
              key={source.id}
              type="button"
              onClick={() => onSource(source)}
              className="rounded bg-secondary px-1.5 py-0.5 text-xs font-medium text-secondary-foreground hover:underline"
            >
              {source.citation}
            </button>
          ))}
        </div>
      )}
      {!message.pending && message.noSource && (
        <p className="rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-xs font-medium text-warning-text">
          {DPO_COPY.noSource}
        </p>
      )}
    </div>
  );
}

export function DpoChat({
  initialConversationId,
  initialMessages,
  blockedReason,
  settingsHref,
  usage,
}: {
  initialConversationId: string | null;
  initialMessages: ChatMessage[];
  /** Why the AI cannot answer here (no key, or the office turned it off). */
  blockedReason: string | null;
  /** Where to turn the Assistente Virtual on, for who may. */
  settingsHref?: string | null;
  usage: { answered: number; limit: number };
}) {
  const router = useRouter();
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [answered, setAnswered] = useState(usage.answered);
  const [source, setSource] = useState<SourceView | null>(null);
  const [lastQuestion, setLastQuestion] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on every new piece of the conversation
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  function patchLast(patch: (message: ChatMessage) => ChatMessage) {
    setMessages((current) => {
      const next = [...current];
      const last = next.at(-1);
      if (last) next[next.length - 1] = patch(last);
      return next;
    });
  }

  function handle(event: DpoEvent) {
    switch (event.type) {
      case "start":
        setConversationId(event.conversationId);
        // What the screen keeps is what was stored: the masked text.
        setMessages((current) => {
          const next = [...current];
          const index = next.findLastIndex((m) => m.role === "user");
          if (index >= 0) {
            next[index] = {
              ...next[index],
              content: event.maskedText,
              maskedNotice: event.maskedNotice,
            };
          }
          return [...next, { role: "assistant", content: "", pending: true }];
        });
        if (!initialConversationId) {
          window.history.replaceState(
            null,
            "",
            `/admin/dpo?c=${event.conversationId}`,
          );
        }
        break;
      case "delta":
        patchLast((m) => ({ ...m, content: m.content + event.text }));
        break;
      case "refused":
        patchLast(() => ({ role: "refusal", content: event.text }));
        break;
      case "done":
        patchLast(() => ({
          id: event.messageId,
          role: "assistant",
          content: event.text,
          sources: event.sources,
          noSource: event.noSource,
        }));
        setAnswered(event.usage.answered);
        break;
      case "blocked":
        setBlocked(event.message);
        setMessages((current) => current.slice(0, -1));
        break;
      case "error":
        setMessages((current) => {
          const last = current.at(-1);
          const base =
            last?.role === "assistant" && last.pending
              ? current.slice(0, -1)
              : current;
          return [...base, { role: "error", content: event.message }];
        });
        break;
    }
  }

  async function send(question: string) {
    const text = question.trim();
    if (!text || busy) return;
    setBusy(true);
    setLastQuestion(text);
    setInput("");
    setMessages((current) => [
      ...current.filter((m) => m.role !== "error"),
      { role: "user", content: text },
    ]);
    try {
      const response = await fetch("/api/dpo/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text, conversationId }),
      });
      if (!response.ok || !response.body) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        handle({ type: "error", message: body?.error ?? DPO_COPY.failed });
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let newline = buffer.indexOf("\n");
        while (newline >= 0) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          if (line) handle(JSON.parse(line) as DpoEvent);
          newline = buffer.indexOf("\n");
        }
      }
    } catch {
      handle({ type: "error", message: DPO_COPY.failed });
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  const remaining = Math.max(usage.limit - answered, 0);

  return (
    <div className="flex flex-col gap-4">
      {messages.length === 0 && (
        <div className="rounded-xl border bg-card p-5 text-sm leading-relaxed text-muted-foreground shadow-xs">
          Pergunte sobre LGPD, Provimento 213/2026, o papel do encarregado,
          direitos do titular, respostas ao titular e à ANPD, incidentes ou a
          adequação da serventia. Peça também rascunhos de documentos, como uma
          justificativa de negativa ou uma comunicação de incidente.
        </div>
      )}

      <ol className="flex flex-col gap-3" aria-live="polite">
        {messages.map((message, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the list only grows at the end
          <li key={i}>
            {message.role === "user" ? (
              <div className="ml-auto flex max-w-[85%] flex-col items-end gap-1">
                <p className="whitespace-pre-wrap rounded-xl bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                  {message.content}
                </p>
                {message.maskedNotice && (
                  <p className="text-xs text-muted-foreground">
                    {message.maskedNotice}
                  </p>
                )}
              </div>
            ) : message.role === "assistant" ? (
              message.pending && !message.content ? (
                <p className="text-sm text-muted-foreground">
                  Consultando a base de normas…
                </p>
              ) : (
                <AssistantMessage message={message} onSource={setSource} />
              )
            ) : message.role === "refusal" ? (
              <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground shadow-xs">
                {message.content}
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-destructive/30 bg-card p-4 text-sm text-destructive shadow-xs">
                <span>{message.content}</span>
                {lastQuestion && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setMessages((current) => current.slice(0, -2));
                      void send(lastQuestion);
                    }}
                  >
                    Tentar de novo
                  </Button>
                )}
              </div>
            )}
          </li>
        ))}
      </ol>
      <div ref={endRef} />

      {blocked ? (
        <p className="rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm font-medium text-warning-text">
          {blocked}
        </p>
      ) : blockedReason ? (
        <div className="flex flex-col gap-2 rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground">
          <p>{blockedReason}</p>
          {settingsHref && (
            <a
              href={settingsHref}
              className="self-start font-medium text-primary underline underline-offset-4"
            >
              Ligar o Assistente Virtual
            </a>
          )}
        </div>
      ) : (
        <form
          className="sticky bottom-0 flex flex-col gap-2 rounded-xl border bg-card p-3 shadow-xs"
          onSubmit={(event) => {
            event.preventDefault();
            void send(input);
          }}
        >
          <p className="rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-xs font-medium text-warning-text">
            {DPO_COPY.dataNotice}
          </p>
          <Label htmlFor="dpo-question" className="sr-only">
            Sua pergunta
          </Label>
          <Textarea
            id="dpo-question"
            rows={3}
            maxLength={MAX_LENGTH}
            value={input}
            disabled={busy}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send(input);
              }
            }}
            placeholder="Escreva sua dúvida sobre proteção de dados…"
            className="field-sizing-fixed bg-background"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {remaining} de {usage.limit} perguntas disponíveis neste mês para
              a serventia
            </span>
            <Button type="submit" disabled={busy || !input.trim()}>
              {busy ? "Respondendo…" : "Enviar"}
            </Button>
          </div>
        </form>
      )}

      <Dialog
        open={source !== null}
        onOpenChange={(open) => {
          if (!open) setSource(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          {source && (
            <>
              <DialogHeader>
                <DialogTitle>{source.citation}</DialogTitle>
                <DialogDescription>
                  {source.guidance
                    ? "Orientação da plataforma (não é norma)"
                    : source.sourceName}
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {source.text}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
