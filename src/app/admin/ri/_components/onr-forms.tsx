"use client";

import { useActionState } from "react";
import { Button } from "../../_ui/button.tsx";
import { NativeSelect } from "../../_ui/native-select.tsx";
import { generateExportAction, type RiState } from "../actions.ts";
import { useRiToast } from "./client.tsx";

const IDLE: RiState = { status: "idle" };

/** One card per file: what it is, the rule, and the button. */
export function GenerateCard({
  kind,
  title,
  rule,
  how,
  withMode,
}: {
  kind: "cnm" | "indicador-real" | "indicador-pessoal";
  title: string;
  rule: string;
  how: string;
  withMode?: boolean;
}) {
  const [state, action, pending] = useActionState(generateExportAction, IDLE);
  useRiToast(state);
  return (
    <form
      action={action}
      className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-xs"
    >
      <input type="hidden" name="kind" value={kind} />
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{rule}</p>
      </div>
      <p className="text-xs text-foreground">{how}</p>
      {withMode && (
        <div className="flex flex-col gap-1 text-xs font-medium">
          <label htmlFor={`mode-${kind}`}>O que vai no arquivo</label>
          <NativeSelect
            id={`mode-${kind}`}
            name="mode"
            defaultValue="completa"
            className="w-full"
          >
            <option value="completa">A base completa</option>
            <option value="atualizacao">
              Só o que mudou desde o último arquivo
            </option>
          </NativeSelect>
        </div>
      )}
      {state.status === "error" && (
        <p role="alert" className="text-xs font-medium text-destructive">
          {state.message}
        </p>
      )}
      <div className="mt-auto">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Gerando…" : "Gerar o arquivo"}
        </Button>
      </div>
    </form>
  );
}
