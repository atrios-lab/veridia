"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "../../../_ui/button.tsx";
import { Input } from "../../../_ui/input.tsx";
import { Label } from "../../../_ui/label.tsx";
import { type AccessState, setOfficeTwoStep } from "./actions.ts";

/**
 * On or off for the whole office: off, the panel asks only for the
 * password (an e-mail outage, a code that does not arrive), until it is
 * turned on again. Who changed it, when and why stay in the audit.
 */
export function TwoStepSwitch({
  enabled,
  changedLine,
}: {
  enabled: boolean;
  /** "Desligada em 11/11/2026, 10:20: motivo", when it was changed. */
  changedLine: string | null;
}) {
  const [state, action, pending] = useActionState<AccessState, FormData>(
    setOfficeTwoStep,
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
      className={`rounded-xl border px-5 py-4 ${enabled ? "bg-card" : "border-warning/30 bg-warning-soft"}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            {enabled
              ? "Duas etapas: ligada"
              : "Duas etapas: desligada (só senha)"}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {enabled
              ? "Se o código não estiver chegando por e-mail, desligue aqui. Ligue de novo assim que voltar ao normal."
              : "O painel está pedindo só a senha. Ligue de novo assim que o e-mail voltar ao normal."}
          </p>
          {changedLine && (
            <p className="mt-1 text-xs text-muted-foreground">{changedLine}</p>
          )}
        </div>
        {enabled ? (
          <Button
            type="button"
            onClick={() => setAsking(true)}
            variant="outline"
            aria-expanded={asking}
          >
            Desligar
          </Button>
        ) : (
          <form action={action}>
            <input type="hidden" name="twoStep" value="on" />
            <Button type="submit" disabled={pending}>
              {pending ? "Ligando..." : "Ligar de novo"}
            </Button>
          </form>
        )}
      </div>
      {enabled && asking && (
        <form action={action} className="mt-3 flex flex-col gap-2">
          <input type="hidden" name="twoStep" value="off" />
          <Label className="flex-col items-stretch gap-1.5 text-foreground">
            Motivo (vai para a auditoria)
            <Input
              name="reason"
              required
              placeholder="Ex.: o código não está chegando no e-mail"
              className="font-normal"
            />
          </Label>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={pending} size="sm">
              {pending ? "Desligando..." : "Desligar as duas etapas"}
            </Button>
            <Button
              type="button"
              onClick={() => setAsking(false)}
              variant="outline"
              size="sm"
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
