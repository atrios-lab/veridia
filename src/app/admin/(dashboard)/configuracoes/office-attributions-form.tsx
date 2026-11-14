"use client";

import { useActionState, useState } from "react";
import {
  ATTRIBUTION_REGIME_LABELS,
  ATTRIBUTION_REGIMES,
  type AttributionRegime,
} from "@/core/tenant/schema.ts";
import { Button } from "../../_ui/button.tsx";
import { NativeSelect, NativeSelectOption } from "../../_ui/native-select.tsx";
import {
  type OfficeAttributionsState,
  saveOfficeAttributions,
} from "./actions.ts";

export interface AttributionChoice {
  key: string;
  label: string;
  gloss: string;
  offered: boolean;
  regime: AttributionRegime;
}

/**
 * The attributions the office marks it offers, each with who answers for
 * it (decision of 14/11/2026: "no próprio CNJ o cartório quem marca o que
 * ele oferece ou não"). What is unmarked leaves the site and the panel.
 */
export function OfficeAttributionsForm({
  choices,
}: {
  choices: AttributionChoice[];
}) {
  const [state, action, pending] = useActionState<
    OfficeAttributionsState,
    FormData
  >(saveOfficeAttributions, { status: "idle" });
  const [offered, setOffered] = useState(
    () => new Set(choices.filter((c) => c.offered).map((c) => c.key)),
  );

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {choices.map((c) => {
          const on = offered.has(c.key);
          return (
            <div
              key={c.key}
              className={`flex flex-col gap-2.5 rounded-lg border bg-muted/50 px-3.5 py-3 ${
                on ? "border-primary/40" : ""
              }`}
            >
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  name={`oferece.${c.key}`}
                  checked={on}
                  onChange={() =>
                    setOffered((current) => {
                      const next = new Set(current);
                      if (next.has(c.key)) next.delete(c.key);
                      else next.add(c.key);
                      return next;
                    })
                  }
                  className="checkbox-admin mt-0.5"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">
                    {c.label}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {c.gloss}
                  </span>
                </span>
                <span
                  className={`flex-none text-xs font-semibold ${
                    on ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {on ? "Oferece" : "Não oferece"}
                </span>
              </label>
              {on && (
                <NativeSelect
                  name={`regime.${c.key}`}
                  defaultValue={c.regime}
                  aria-label={`Quem responde por ${c.label}`}
                  className="w-full"
                  size="sm"
                >
                  {ATTRIBUTION_REGIMES.map((regime) => (
                    <NativeSelectOption key={regime} value={regime}>
                      {ATTRIBUTION_REGIME_LABELS[regime]}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              )}
            </div>
          );
        })}
      </div>
      {state.status === "error" && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {state.message}
        </p>
      )}
      {state.status === "saved" && (
        <p className="text-sm font-semibold text-success-text">
          Atribuições salvas. O site e o painel já mostram só o que a serventia
          oferece.
        </p>
      )}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : "Salvar atribuições"}
        </Button>
      </div>
    </form>
  );
}
