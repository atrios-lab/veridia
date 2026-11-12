"use client";

import { useActionState, useRef } from "react";
import type { ExemptionDecisionOutcome } from "@/core/request/kinds.ts";
import { EXEMPTION_DECISION_OUTCOMES } from "@/core/request/kinds.ts";
import {
  NativeSelect,
  NativeSelectOption,
} from "../../../../_ui/native-select.tsx";
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
      <NativeSelect
        name="outcome"
        size="sm"
        aria-label="Desfecho da gratuidade"
        defaultValue={outcome ?? ""}
        disabled={pending}
        onChange={() => formRef.current?.requestSubmit()}
        className="[&_select]:border-warning/40 [&_select]:bg-background [&_select]:text-xs [&_select]:font-medium [&_select]:text-warning-text"
      >
        <NativeSelectOption value="">Sem decisão</NativeSelectOption>
        {EXEMPTION_DECISION_OUTCOMES.map((value) => (
          <NativeSelectOption key={value} value={value}>
            {OUTCOME_LABELS[value]}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {state.status === "error" && (
        <span className="text-xs font-medium text-destructive">
          {state.message}
        </span>
      )}
    </form>
  );
}
