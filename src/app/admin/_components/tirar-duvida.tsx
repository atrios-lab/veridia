"use client";

import { useActionState, useId, useState } from "react";
import {
  QUESTION_MAX,
  QUESTION_TOPICS,
  type QuestionTopicKey,
} from "@/core/assistente/duvidas.ts";
import { Button } from "../_ui/button.tsx";
import { Label } from "../_ui/label.tsx";
import { Textarea } from "../_ui/textarea.tsx";
import {
  askQuestionAction,
  type QuestionState,
} from "../(dashboard)/assistente/actions.ts";

/**
 * "Tirar dúvida com o Assistente Virtual", on the screens where a doubt
 * comes up (decision of 15/11/2026). Closed by default; the question is
 * about the screen's subject only, and it says so.
 */
export function TirarDuvida({ topic }: { topic: QuestionTopicKey }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<QuestionState, FormData>(
    askQuestionAction,
    { status: "idle" },
  );
  const id = useId();
  const label = QUESTION_TOPICS[topic].label;
  if (!open) {
    return (
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
        >
          Tirar dúvida com o Assistente Virtual
        </Button>
      </div>
    );
  }
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-primary/25 bg-primary/5 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-foreground">
          Dúvida sobre {label}
        </h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs font-medium text-muted-foreground underline underline-offset-4"
        >
          Fechar
        </button>
      </div>
      <p className="text-xs text-muted-foreground text-justify hyphens-auto">
        O Assistente Virtual responde só sobre {label}, com base na base
        jurídica da serventia e nas fontes oficiais, e cita o dispositivo. É
        orientação: a decisão é do oficial. Não escreva nomes, CPF ou outros
        dados de pessoas; se escrever, eles são ocultados antes do envio.
      </p>
      <form action={action} className="flex flex-col gap-2">
        <input type="hidden" name="tema" value={topic} />
        <Label htmlFor={`${id}-q`} className="sr-only">
          Sua dúvida
        </Label>
        <Textarea
          id={`${id}-q`}
          name="pergunta"
          rows={3}
          maxLength={QUESTION_MAX}
          required
          placeholder="Ex.: qual o prazo para a reapresentação do título?"
        />
        <div>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Consultando..." : "Perguntar"}
          </Button>
        </div>
      </form>
      {state.status === "error" && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {state.message}
        </p>
      )}
      {state.status === "answered" && (
        <div
          aria-live="polite"
          className="flex flex-col gap-2 rounded-lg border bg-card p-4 text-sm"
        >
          {state.masked && (
            <p className="text-xs text-muted-foreground">{state.masked}</p>
          )}
          <p className="whitespace-pre-line text-foreground text-justify hyphens-auto">
            {state.answer}
          </p>
          {state.inScope && state.sources.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Fontes: {state.sources.join("; ")}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
