"use client";

import { useActionState } from "react";
import { DEMO_RESET_CONFIRMATION } from "@/core/tenant/demo-office.ts";
import { Button } from "../../../../../_ui/button.tsx";
import { Input } from "../../../../../_ui/input.tsx";
import {
  type DemoResetState,
  resetDemoOfficeAction,
} from "../demo-reset-actions.ts";
import { Field, FormError } from "./fields.tsx";

/**
 * The cleaning of the demonstration office, beside the cohorts it serves.
 * Deletes what every participant did there and seeds the office again; the
 * accounts, the cohorts, the progress, the certificates and the audit stay.
 */
export function DemoResetForm() {
  const [state, formAction, pending] = useActionState<DemoResetState, FormData>(
    resetDemoOfficeAction,
    { status: "idle" },
  );

  return (
    <div className="rounded-xl border bg-card p-6">
      <h2 className="text-lg font-semibold text-foreground">
        Limpar o cartório de demonstração
      </h2>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Apaga tudo o que os participantes fizeram no painel e no site do
        Cartório Vale do Silício (pedidos, agenda, LGPD, ouvidoria, publicações,
        configurações, arquivos) e volta aos dados fictícios do começo. Contas,
        turmas, progresso nos cursos, certificados e auditoria não mudam. Não
        tem como desfazer.
      </p>
      <form action={formAction} className="mt-4 flex flex-col gap-3.5">
        <Field
          name="confirmation"
          label={`Para confirmar, digite ${DEMO_RESET_CONFIRMATION}`}
        >
          <Input
            id="confirmation"
            name="confirmation"
            autoComplete="off"
            required
          />
        </Field>
        <FormError
          message={state.status === "error" ? state.message : undefined}
        />
        {state.status === "done" && (
          <output className="rounded-lg border px-4 py-3 text-sm text-foreground">
            Cartório de demonstração limpo: {state.rows}{" "}
            {state.rows === 1 ? "registro apagado" : "registros apagados"} e{" "}
            {state.files} {state.files === 1 ? "arquivo" : "arquivos"}. Os dados
            fictícios do começo já estão de volta.
          </output>
        )}
        <Button
          type="submit"
          variant="destructive"
          disabled={pending}
          className="self-start"
        >
          {pending ? "Limpando…" : "Limpar o cartório de demonstração"}
        </Button>
      </form>
    </div>
  );
}
