"use client";

import { useActionState } from "react";
import { Button } from "../../_ui/button.tsx";
import { Input } from "../../_ui/input.tsx";
import { Label } from "../../_ui/label.tsx";
import { type RiState, saveRiSettingsAction } from "../actions.ts";
import { useRiToast } from "./client.tsx";

const IDLE: RiState = { status: "idle" };

export function SettingsForm({ ibgeCity }: { ibgeCity: string }) {
  const [state, action, pending] = useActionState(saveRiSettingsAction, IDLE);
  useRiToast(state);
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex max-w-xs flex-col gap-1.5">
        <Label htmlFor="ri-ibge">Código IBGE do município (7 dígitos)</Label>
        <Input
          id="ri-ibge"
          name="ibgeCity"
          inputMode="numeric"
          defaultValue={ibgeCity}
          className="bg-background"
        />
        <p className="text-xs text-muted-foreground">
          Vai no campo CIDADE do Indicador Real. Consulte na tabela de
          municípios do IBGE (servicodados.ibge.gov.br).
        </p>
      </div>
      {state.status === "error" && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {state.message}
        </p>
      )}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </form>
  );
}
