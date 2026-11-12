"use client";

import { useActionState } from "react";
import {
  OMBUDSMAN_STATUSES,
  type OmbudsmanStatus,
  statusLabel,
  suggestedOmbudsmanStatuses,
} from "@/core/request/kinds.ts";
import { Button } from "../../../../_ui/button.tsx";
import {
  NativeSelect,
  NativeSelectOption,
} from "../../../../_ui/native-select.tsx";
import { type ActionState, changeManifestationStatus } from "../actions.ts";

/** The four the office may set. "Respondida" is reached by sending the reply,
 * never by picking it here: see `isAllowedOmbudsmanTransition`. */
const SELECTABLE = OMBUDSMAN_STATUSES.filter((s) => s !== "answered");

/** Outline colour matching what each destination means: grey for a stop,
 * neutral for the rest. */
function pillClass(status: OmbudsmanStatus): string {
  if (status === "archived") {
    return "rounded-full bg-muted text-muted-foreground";
  }
  return "rounded-full";
}

export function ManifestationStatusSection({
  requestId,
  status,
}: {
  requestId: string;
  status: OmbudsmanStatus;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    changeManifestationStatus,
    { status: "idle" },
  );

  const suggested = suggestedOmbudsmanStatuses(status);

  return (
    <div className="mt-5 border-t pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-foreground">Mudar para:</span>
        {suggested.map((next) => (
          <form key={next} action={action}>
            <input type="hidden" name="requestId" value={requestId} />
            <input type="hidden" name="status" value={next} />
            <Button
              type="submit"
              variant="outline"
              size="sm"
              disabled={pending}
              className={pillClass(next)}
            >
              {statusLabel("ombudsman", next)}
            </Button>
          </form>
        ))}
      </div>

      <details className="mt-4">
        <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
          Corrigir para outro andamento
        </summary>
        <form action={action} className="mt-2.5 flex items-center gap-2.5">
          <input type="hidden" name="requestId" value={requestId} />
          {/* Flat list: four options are not the wall that makes
              /admin/pedidos group its eighteen by phase. */}
          <NativeSelect
            name="status"
            aria-label="Andamento"
            defaultValue={status === "answered" ? "done" : status}
          >
            {SELECTABLE.map((s) => (
              <NativeSelectOption key={s} value={s}>
                {statusLabel("ombudsman", s)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <Button type="submit" disabled={pending}>
            {pending ? "Aplicando…" : "Aplicar"}
          </Button>
        </form>
      </details>

      {state.status === "error" && (
        <p role="alert" className="mt-3 text-sm font-medium text-destructive">
          {state.message}
        </p>
      )}
    </div>
  );
}
