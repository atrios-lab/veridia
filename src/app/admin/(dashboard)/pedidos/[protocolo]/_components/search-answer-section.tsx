"use client";

import { useActionState, useEffect, useState } from "react";
import { useEmailWarning } from "../../../../_components/use-email-warning.ts";
import { type ActionState, answerSearchAction } from "../actions.ts";

const FIELD =
  "w-full rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3.5 py-2.5 text-[13px] text-admin-text";

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
    <div className="rounded-[14px] border-2 border-admin-primary bg-admin-card p-6">
      <div className="flex items-center gap-2.5">
        <h4 className="flex-1 font-serif text-[17px] font-semibold text-admin-primary">
          Resposta da busca
        </h4>
        {answer && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="btn btn-admin-secondary btn-sm"
          >
            Corrigir resposta
          </button>
        )}
      </div>
      <p className="mt-1 text-[12.5px] leading-relaxed text-admin-muted">
        A busca é só uma consulta: não tem entrega. Responda aqui se o registro
        consta nesta serventia e o que foi perguntado. O pedido é concluído, e o
        cidadão recebe um e-mail para ler a resposta na consulta do protocolo.
        Se quiser a certidão, ele faz um novo pedido no ato certo. Se a
        serventia cobra a busca, informe o valor no cartão "Valor do pedido".
      </p>
      {unpaid && editing && (
        <p className="mt-2.5 rounded-lg bg-admin-warning-text px-3 py-2.5 text-[12.5px] leading-snug text-white">
          <strong className="font-bold">
            O valor da busca ainda não foi pago.
          </strong>{" "}
          Responder agora conclui o pedido e tira a cobrança da consulta do
          protocolo.
        </p>
      )}

      {answer && !editing && (
        <div className="mt-3.5 flex flex-col gap-2">
          <span
            className={`inline-flex w-fit items-center rounded-full px-[11px] py-[5px] text-[12px] font-bold text-white ${
              answer.found ? "bg-admin-success-text" : "bg-admin-warning-text"
            }`}
          >
            {answer.found ? "Registro localizado" : "Registro não localizado"}
          </span>
          <p className="whitespace-pre-line text-[13px] leading-relaxed text-admin-text">
            {answer.text}
          </p>
          <p className="text-[11px] text-admin-faint">
            Respondida em {answer.answeredAtLabel}
          </p>
        </div>
      )}

      {editing && (
        <form action={action} className="mt-3.5 flex flex-col gap-3">
          <input type="hidden" name="requestId" value={requestId} />
          <fieldset className="flex flex-wrap gap-4">
            <legend className="mb-1.5 text-xs font-bold text-admin-primary">
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
                  className="h-4 w-4 accent-admin-primary-soft"
                />
                <span className="text-[12.5px] text-admin-text">{label}</span>
              </label>
            ))}
          </fieldset>
          <div>
            <label
              htmlFor="search-answer-text"
              className="mb-1.5 block text-xs font-bold text-admin-primary"
            >
              Resposta ao cidadão
            </label>
            <textarea
              id="search-answer-text"
              name="text"
              rows={4}
              defaultValue={answer?.text}
              placeholder="Ex.: O registro de nascimento consta nesta serventia. A profissão registrada é agricultor."
              className={FIELD}
            />
          </div>
          <div className="flex gap-2.5">
            <button
              type="submit"
              disabled={pending}
              className="btn btn-admin-primary btn-md"
            >
              {pending
                ? "Enviando…"
                : answer
                  ? "Salvar correção"
                  : "Enviar resposta e concluir"}
            </button>
            {answer && (
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="btn btn-admin-secondary btn-md"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      )}

      {state.status === "error" && (
        <p
          role="alert"
          className="mt-2 text-[12.5px] font-semibold text-admin-error-text"
        >
          {state.message}
        </p>
      )}
    </div>
  );
}
