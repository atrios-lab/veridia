"use client";

import { useActionState, useRef } from "react";
import type { ExemptionDecisionOutcome } from "@/core/request/kinds.ts";
import { EXEMPTION_DECISION_OUTCOMES } from "@/core/request/kinds.ts";
import { type ActionState, setExemptionDecisionAction } from "../actions.ts";

const OUTCOME_LABELS: Record<ExemptionDecisionOutcome, string> = {
  granted: "Concedida",
  referred: "Submetida ao Juízo",
  denied: "Indeferida",
  installments: "Substituída por parcelamento",
};

/**
 * The desfecho da gratuidade, a select next to the "Gratuidade solicitada"
 * pill (Provimento CGJ/TJRN n. 7/2026, art. 11). Changing it submits at
 * once: there is no separate "salvar", the same way `StatusControl` moves an
 * andamento on click. Picking "Sem decisão" clears a decision recorded by
 * mistake.
 */
export function ExemptionDecisionControl({
  requestId,
  outcome,
}: {
  requestId: string;
  outcome?: ExemptionDecisionOutcome;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    setExemptionDecisionAction,
    { status: "idle" },
  );
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={action}
      className="inline-flex items-center gap-1.5"
    >
      <input type="hidden" name="requestId" value={requestId} />
      <select
        name="outcome"
        defaultValue={outcome ?? ""}
        disabled={pending}
        onChange={() => formRef.current?.requestSubmit()}
        className="rounded-full border border-admin-warning-text bg-transparent px-2.5 py-[3px] text-[11px] font-bold text-admin-warning-text"
      >
        <option value="">Sem decisão</option>
        {EXEMPTION_DECISION_OUTCOMES.map((value) => (
          <option key={value} value={value}>
            {OUTCOME_LABELS[value]}
          </option>
        ))}
      </select>
      {state.status === "error" && (
        <span className="text-[11px] font-semibold text-admin-error-text">
          {state.message}
        </span>
      )}
    </form>
  );
}
