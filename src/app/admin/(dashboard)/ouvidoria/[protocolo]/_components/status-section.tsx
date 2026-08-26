"use client";

import { useActionState } from "react";
import {
  OMBUDSMAN_STATUSES,
  type OmbudsmanStatus,
  statusLabel,
  suggestedOmbudsmanStatuses,
} from "@/core/request/kinds.ts";
import { AdminIcon } from "../../../../_components/icon.tsx";
import { type ActionState, changeManifestationStatus } from "../actions.ts";

/** The four the office may set. "Respondida" is reached by sending the reply,
 * never by picking it here: see `isAllowedOmbudsmanTransition`. */
const SELECTABLE = OMBUDSMAN_STATUSES.filter((s) => s !== "answered");

/** Outline colour matching what each destination means: grey for a stop,
 * neutral for the rest. */
function pillClass(status: OmbudsmanStatus): string {
  if (status === "archived") {
    return "rounded-full border border-admin-border bg-admin-readonly-bg px-3.5 py-1.5 text-[12.5px] font-semibold text-admin-muted disabled:opacity-60";
  }
  return "rounded-full border border-admin-input-border bg-admin-input-bg px-3.5 py-1.5 text-[12.5px] font-semibold text-admin-primary disabled:opacity-60";
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
    <div className="mt-5 border-t border-admin-border pt-4.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-admin-primary">
          Mudar para:
        </span>
        {suggested.map((next) => (
          <form key={next} action={action}>
            <input type="hidden" name="requestId" value={requestId} />
            <input type="hidden" name="status" value={next} />
            <button
              type="submit"
              disabled={pending}
              className={pillClass(next)}
            >
              {statusLabel("ombudsman", next)}
            </button>
          </form>
        ))}
      </div>

      <details className="mt-3.5">
        <summary className="cursor-pointer text-[12px] font-semibold text-admin-muted">
          Corrigir para outro andamento
        </summary>
        <form action={action} className="mt-2.5 flex items-center gap-2.5">
          <input type="hidden" name="requestId" value={requestId} />
          <div className="relative">
            {/* Flat list: four options are not the wall that makes
                /admin/pedidos group its eighteen by phase. */}
            <select
              name="status"
              defaultValue={status === "answered" ? "done" : status}
              className="appearance-none rounded-[9px] border border-admin-input-border bg-admin-input-bg py-2 pr-9 pl-3 text-[13px] text-admin-text"
            >
              {SELECTABLE.map((s) => (
                <option key={s} value={s}>
                  {statusLabel("ombudsman", s)}
                </option>
              ))}
            </select>
            <AdminIcon
              name="chevronDown"
              className="pointer-events-none absolute top-1/2 right-3 h-3.5 w-3.5 -translate-y-1/2 text-admin-muted"
              strokeWidth={2}
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="btn btn-admin-primary btn-md"
          >
            {pending ? "Aplicando…" : "Aplicar"}
          </button>
        </form>
      </details>

      {state.status === "error" && (
        <p
          role="alert"
          className="mt-3 text-[12.5px] font-semibold text-admin-error-text"
        >
          {state.message}
        </p>
      )}
    </div>
  );
}
