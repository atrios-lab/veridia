"use client";

import { useActionState, useId } from "react";
import { buttonVariants } from "../../_ui/button.tsx";
import { NativeSelect } from "../../_ui/native-select.tsx";
import {
  markTermSignedAction,
  type RiState,
  unmarkTermSignedAction,
} from "../actions.ts";
import { ConfirmButton, useRiToast } from "./client.tsx";

const IDLE: RiState = { status: "idle" };

export interface TermSignView {
  kind: "abertura" | "encerramento";
  /** "assinado digitalmente, com certificado ICP-Brasil, em 28/11/2026". */
  signed: string | null;
  /** The termo PDF, to print. */
  pdf: string;
}

/**
 * Where the termo stands (decision of 28/11/2026): to sign now, later, or
 * already signed and how, with "Imprimir" and "Assinar novamente".
 */
export function TermSign({
  id,
  term,
  canManage,
}: {
  id: string;
  term: TermSignView;
  canManage: boolean;
}) {
  const [state, action, pending] = useActionState(markTermSignedAction, IDLE);
  useRiToast(state);
  const fieldId = useId();
  const name = `Termo de ${term.kind}`;
  if (term.signed) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-success/30 bg-success-soft px-4 py-3">
        <p className="text-sm font-semibold text-success-text">
          {name} assinado {term.signed}.
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            href={term.pdf}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ size: "sm", variant: "outline" })}
          >
            Imprimir
          </a>
          <a
            href="#termos"
            className={buttonVariants({ size: "sm", variant: "outline" })}
          >
            Assinar novamente
          </a>
          {canManage && (
            <ConfirmButton
              action={unmarkTermSignedAction}
              fields={{ id, tipo: term.kind }}
              trigger="Desmarcar"
              question={`Desmarcar a assinatura do ${name.toLowerCase()}?`}
              consequence="Use só se foi marcado por engano. A marcação anterior fica no histórico do livro e na auditoria."
              confirmLabel="Desmarcar"
              pendingLabel="Desmarcando…"
              destructive={false}
            />
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3">
      <p className="text-sm font-semibold text-warning-text">
        {name} ainda não assinado.
      </p>
      <div className="flex flex-wrap gap-2">
        <a href="#termos" className={buttonVariants({ size: "sm" })}>
          Assinar agora
        </a>
        <a
          href="/admin/ri/livros"
          className={buttonVariants({ size: "sm", variant: "outline" })}
        >
          Assinar depois
        </a>
      </div>
      <p className="text-xs text-muted-foreground">
        &quot;Assinar depois&quot; volta à lista dos livros: o botão
        &quot;Assinar o termo&quot; fica ao lado deste livro até ele ser
        assinado.
      </p>
      {canManage && (
        <form action={action} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="tipo" value={term.kind} />
          <div className="flex flex-col gap-1.5 text-sm">
            <label htmlFor={`${fieldId}-format`}>Já assinei</label>
            <NativeSelect
              id={`${fieldId}-format`}
              name="formato"
              defaultValue="digital"
            >
              <option value="digital">
                Digitalmente, com certificado ICP-Brasil
              </option>
              <option value="manual">À mão, no papel</option>
              <option value="imagem">
                Com a imagem da assinatura cadastrada
              </option>
            </NativeSelect>
          </div>
          <button
            type="submit"
            disabled={pending}
            className={buttonVariants({ size: "sm", variant: "outline" })}
          >
            {pending ? "Salvando…" : "Marcar como assinado"}
          </button>
        </form>
      )}
    </div>
  );
}
