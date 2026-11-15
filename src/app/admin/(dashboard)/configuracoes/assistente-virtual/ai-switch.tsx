"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "../../../_ui/button.tsx";
import { Input } from "../../../_ui/input.tsx";
import { Label } from "../../../_ui/label.tsx";
import { type AiState, setOfficeAi } from "./actions.ts";

export function AiSwitch({
  enabled,
  changedLine,
}: {
  enabled: boolean;
  changedLine: string | null;
}) {
  const [state, action, pending] = useActionState<AiState, FormData>(
    setOfficeAi,
    { status: "idle" },
  );
  const [asking, setAsking] = useState(false);
  useEffect(() => {
    if (state.status === "saved") {
      toast.success(state.message);
      setAsking(false);
    }
  }, [state]);

  return (
    <section
      className={`rounded-xl border px-5 py-4 ${enabled ? "border-primary/25 bg-primary/5" : "bg-card"}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            {enabled
              ? "Assistente Virtual: ligado"
              : "Assistente Virtual: desligado"}
          </h3>
          {changedLine && (
            <p className="mt-1 text-xs text-muted-foreground">{changedLine}</p>
          )}
        </div>
        <Button
          type="button"
          onClick={() => setAsking(true)}
          variant={enabled ? "outline" : "default"}
          aria-expanded={asking}
        >
          {enabled ? "Desligar" : "Ligar"}
        </Button>
      </div>
      {asking && (
        <form action={action} className="mt-3 flex flex-col gap-2">
          <input type="hidden" name="ai" value={enabled ? "off" : "on"} />
          <Label className="flex-col items-stretch gap-1.5 text-foreground">
            Motivo (vai para a auditoria)
            <Input
              name="reason"
              required
              placeholder={
                enabled
                  ? "Ex.: suspender o uso até revisar o contrato"
                  : "Ex.: serventia autorizou o uso na qualificação"
              }
              className="font-normal"
            />
          </Label>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={pending} size="sm">
              {pending
                ? "Salvando..."
                : enabled
                  ? "Desligar o Assistente Virtual"
                  : "Ligar o Assistente Virtual"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setAsking(false)}
            >
              Cancelar
            </Button>
          </div>
        </form>
      )}
      {state.status === "error" && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {state.message}
        </p>
      )}
    </section>
  );
}
