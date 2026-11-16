"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  NOTE_REVIEW_MODES,
  type NoteReviewMode,
} from "@/core/qualificacao/revisao-base.ts";
import { Button } from "../../../_ui/button.tsx";
import { Input } from "../../../_ui/input.tsx";
import { type PlatformState, setAiPlatformAction } from "./actions.ts";

const IDLE: PlatformState = { status: "idle" };

export function PlatformForm({
  slug,
  aiAllowed,
  noteReview,
}: {
  slug: string;
  aiAllowed: boolean;
  noteReview: NoteReviewMode;
}) {
  const [state, action, pending] = useActionState(setAiPlatformAction, IDLE);
  const [allowed, setAllowed] = useState(aiAllowed);
  useEffect(() => {
    if (state.status === "saved") toast.success(state.message);
    if (state.status === "error") toast.error(state.message);
  }, [state]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="tenant" value={slug} />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold text-foreground">
          Assistente Virtual (IA) nesta serventia
        </legend>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="radio"
            name="ia"
            value="liberada"
            checked={allowed}
            onChange={() => setAllowed(true)}
            className="mt-1"
          />
          <span>
            <span className="font-medium">Liberada</span>
            <span className="block text-xs text-muted-foreground">
              A serventia usa a IA onde o Tabelião deixou ligada: qualificação,
              DPO, base jurídica, tirar dúvida.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="radio"
            name="ia"
            value="suspensa"
            checked={!allowed}
            onChange={() => setAllowed(false)}
            className="mt-1"
          />
          <span>
            <span className="font-medium">Suspensa</span>
            <span className="block text-xs text-muted-foreground">
              Nenhuma chamada à IA, nenhum crédito gasto. A serventia vê só
              &quot;O Assistente Virtual está indisponível para esta serventia
              no momento&quot;, sem saber quem suspendeu. O resto do painel
              funciona igual.
            </span>
          </span>
        </label>
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold text-foreground">
          Análise das notas anexadas às exigências
        </legend>
        {(Object.keys(NOTE_REVIEW_MODES) as NoteReviewMode[]).map((mode) => (
          <label key={mode} className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="analise"
              value={mode}
              defaultChecked={noteReview === mode}
              className="mt-1"
            />
            <span>
              <span className="font-medium">
                {NOTE_REVIEW_MODES[mode].label}
              </span>
              <span className="block text-xs text-muted-foreground">
                {NOTE_REVIEW_MODES[mode].description}
              </span>
            </span>
          </label>
        ))}
        {!allowed && (
          <p className="text-xs text-warning-text">
            Com a IA suspensa, a opção &quot;Com o Assistente Virtual&quot;
            funciona como &quot;Só pela base jurídica&quot;: nada é cobrado.
          </p>
        )}
      </fieldset>
      <div className="flex flex-wrap items-end gap-2">
        <label
          htmlFor={`motivo-${slug}`}
          className="flex min-w-60 flex-1 flex-col gap-1 text-sm"
        >
          Motivo (fica na auditoria da plataforma)
          <Input
            id={`motivo-${slug}`}
            name="motivo"
            maxLength={300}
            placeholder="Ex.: teto de gasto do mês atingido"
          />
        </label>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </form>
  );
}
