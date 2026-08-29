"use client";

import { useActionState } from "react";
import {
  MAX_DEADLINE_DAYS,
  MIN_DEADLINE_DAYS,
} from "@/core/request/deadline.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import { AdminIcon } from "../../_components/icon.tsx";
import { type OfficeDeadlineState, saveOfficeDeadline } from "./actions.ts";
import { Field } from "./office-contact-form.tsx";

export function OfficeDeadlineForm({ tenant }: { tenant: Tenant }) {
  const [state, formAction, pending] = useActionState<
    OfficeDeadlineState,
    FormData
  >(saveOfficeDeadline, { status: "idle" });

  // Same reason as the contact form: a refused submit must not wipe what was
  // typed.
  const sent = state.status === "error" ? state.value : undefined;

  return (
    <form action={formAction}>
      <h2 className="font-serif text-[17px] font-semibold text-admin-primary">
        Prazo de análise
      </h2>
      <p className="mt-1 text-[12.5px] text-admin-muted">
        O prazo que o cidadão vê ao abrir um pedido e ao consultar o protocolo.
        Vale para os pedidos em que a serventia não ajustou o prazo à mão.
      </p>

      <div className="mt-4.5 max-w-[260px]">
        <Field
          label="Prazo padrão (dias corridos)"
          name="requestDeadlineDays"
          type="number"
          inputMode="numeric"
          min={MIN_DEADLINE_DAYS}
          max={MAX_DEADLINE_DAYS}
          step={1}
          defaultValue={sent ?? String(tenant.requestDeadlineDays)}
          error={state.status === "error" ? state.message : undefined}
        />
      </div>

      <p className="mt-3.5 text-xs leading-relaxed text-admin-muted">
        No pedido, dá para zerar ou esticar o prazo caso a caso, na hora de
        mudar o andamento. O prazo dos pedidos de direitos do titular (LGPD) é
        de 15 dias por lei e não muda por aqui.
      </p>

      <div className="mt-4.5 flex items-center gap-3.5">
        <button
          type="submit"
          disabled={pending}
          className="btn btn-admin-primary btn-lg"
        >
          {pending ? "Salvando…" : "Salvar"}
        </button>
        {state.status === "saved" && (
          <output className="flex items-center gap-1.5 rounded-full bg-admin-success-bg px-3 py-1.5 text-[12.5px] font-semibold text-admin-success-text">
            <AdminIcon name="check" className="h-3.5 w-3.5" strokeWidth={2.4} />
            Salvo. Já está valendo nos novos pedidos.
          </output>
        )}
      </div>
    </form>
  );
}
