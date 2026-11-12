"use client";

import { useActionState, useEffect, useState } from "react";
import { LONG_TEXT_MAX } from "@/core/text-limits.ts";
import { useEmailWarning } from "../../../../_components/use-email-warning.ts";
import { Badge } from "../../../../_ui/badge.tsx";
import { Button } from "../../../../_ui/button.tsx";
import { Label } from "../../../../_ui/label.tsx";
import { Textarea } from "../../../../_ui/textarea.tsx";
import { type ActionState, answerSearchAction } from "../actions.ts";

/**
 * A resposta da busca de registro, no lugar da entrega: a busca é uma
 * consulta, e responder é o que ela devolve. O valor é facultativo e fica no
 * cartão de sempre, porque há serventias que cobram a busca pela tabela. O pedido é concluído e o cidadão
 * lê a resposta na consulta do protocolo, com o caminho para pedir a certidão
 * no ato certo.
 */
export function SearchAnswerSection({
  requestId,
  answer,
  unpaid,
}: {
  requestId: string;
  /** Há valor informado e o pagamento ainda não foi confirmado. */
  unpaid?: boolean;
  answer?: { found: boolean; text: string; answeredAtLabel: string };
}) {
  const [editing, setEditing] = useState(!answer);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    answerSearchAction,
    { status: "idle" },
  );
  useEmailWarning(state);

  useEffect(() => {
    if (state.status === "success") setEditing(false);
  }, [state]);

  return (
    <div className="rounded-xl border-2 border-primary bg-card p-6">
      <div className="flex items-center gap-2">
        <h4 className="flex-1 text-base font-semibold text-foreground">
          Resposta da busca
        </h4>
        {answer && !editing && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setEditing(true)}
          >
            Corrigir resposta
          </Button>
        )}
      </div>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        A busca é só uma consulta: não tem entrega. Responda aqui se o registro
        consta nesta serventia e o que foi perguntado. O pedido é concluído, e o
        cidadão recebe um e-mail para ler a resposta na consulta do protocolo.
        Se quiser a certidão, ele faz um novo pedido no ato certo. Se a
        serventia cobra a busca, informe o valor no cartão "Valor do pedido".
      </p>
      {unpaid && editing && (
        <p className="mt-2 rounded-lg bg-warning px-3 py-2 text-sm leading-snug text-warning-foreground">
          <strong className="font-semibold">
            O valor da busca ainda não foi pago.
          </strong>{" "}
          Responder agora conclui o pedido e tira a cobrança da consulta do
          protocolo.
        </p>
      )}

      {answer && !editing && (
        <div className="mt-4 flex flex-col gap-2">
          <Badge
            className={`h-6 px-2.5 ${
              answer.found
                ? "bg-success text-success-foreground"
                : "bg-warning text-warning-foreground"
            }`}
          >
            {answer.found ? "Registro localizado" : "Registro não localizado"}
          </Badge>
          <p className="whitespace-pre-line [overflow-wrap:anywhere] text-sm leading-relaxed text-foreground">
            {answer.text}
          </p>
          <p className="text-xs text-muted-foreground">
            Respondida em {answer.answeredAtLabel}
          </p>
        </div>
      )}

      {editing && (
        <form action={action} className="mt-4 flex flex-col gap-4">
          <input type="hidden" name="requestId" value={requestId} />
          <fieldset className="flex flex-wrap gap-4">
            <legend className="mb-2 text-sm font-medium text-foreground">
              O registro foi localizado?
            </legend>
            {(
              [
                ["yes", "Sim, consta nesta serventia"],
                ["no", "Não foi localizado"],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="found"
                  value={value}
                  defaultChecked={
                    answer ? answer.found === (value === "yes") : undefined
                  }
                  className="size-4 accent-primary"
                />
                <span className="text-sm text-foreground">{label}</span>
              </label>
            ))}
          </fieldset>
          <div>
            <Label htmlFor="search-answer-text" className="mb-2">
              Resposta ao cidadão
            </Label>
            <Textarea
              id="search-answer-text"
              name="text"
              rows={4}
              maxLength={LONG_TEXT_MAX}
              defaultValue={answer?.text}
              placeholder="Ex.: O registro de nascimento consta nesta serventia. A profissão registrada é agricultor."
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending
                ? "Enviando…"
                : answer
                  ? "Salvar correção"
                  : "Enviar resposta e concluir"}
            </Button>
            {answer && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditing(false)}
              >
                Cancelar
              </Button>
            )}
          </div>
        </form>
      )}

      {state.status === "error" && (
        <p role="alert" className="mt-2 text-sm font-medium text-destructive">
          {state.message}
        </p>
      )}
    </div>
  );
}
