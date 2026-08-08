"use client";

import { Fragment, useActionState } from "react";
import {
  SERVICE_REQUEST_STATUSES,
  type ServiceRequestStatus,
  statusLabel,
} from "@/core/request/kinds.ts";
import { AdminIcon } from "../../../../_components/icon.tsx";
import { type ActionState, changeStatus } from "../actions.ts";

/** The happy path the progress timeline draws. Off-ramps (Indeferido,
 * Cancelado, Arquivado) have no fixed position on it, so a request in one of
 * those falls back to the plain "andamento atual" line instead of a step. */
const HAPPY_PATH: readonly ServiceRequestStatus[] = [
  "new",
  "in-review",
  "awaiting-payment",
  "paid",
  "done",
];

/** Outline colour for a "mudar para" pill, matching what each destination
 * means: neutral for forward progress, red for a refusal, grey for a stop. */
function suggestionPillClass(status: ServiceRequestStatus): string {
  if (status === "rejected") {
    return "rounded-full border border-admin-error-border bg-admin-error-bg px-3.5 py-1.5 text-[12.5px] font-semibold text-admin-error-text disabled:opacity-60";
  }
  if (status === "cancelled") {
    return "rounded-full border border-admin-border bg-admin-readonly-bg px-3.5 py-1.5 text-[12.5px] font-semibold text-admin-muted disabled:opacity-60";
  }
  return "rounded-full border border-admin-input-border bg-admin-input-bg px-3.5 py-1.5 text-[12.5px] font-semibold text-admin-primary disabled:opacity-60";
}

function TimelineStep({
  label,
  state,
}: {
  label: string;
  state: "done" | "current" | "upcoming";
}) {
  return (
    <div className="flex flex-1 flex-col items-center gap-2">
      {state === "done" && (
        <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-admin-success-text">
          <AdminIcon
            name="check"
            className="h-[13px] w-[13px] text-white"
            strokeWidth={3}
          />
        </span>
      )}
      {state === "current" && (
        <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full border-2 border-admin-primary bg-admin-primary">
          <span className="h-[9px] w-[9px] rounded-full bg-white" />
        </span>
      )}
      {state === "upcoming" && (
        <span className="h-[26px] w-[26px] rounded-full border-2 border-admin-input-border" />
      )}
      <span
        className={`text-center text-[11.5px] font-bold ${
          state === "done"
            ? "text-admin-success-text"
            : state === "current"
              ? "text-admin-primary"
              : "text-admin-faint"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

export function StatusSection({
  requestId,
  status,
  subtitle,
  suggested,
}: {
  requestId: string;
  status: ServiceRequestStatus;
  /** "{ato} · {solicitante} · pedido em {data}" */
  subtitle: string;
  suggested: readonly ServiceRequestStatus[];
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    changeStatus,
    { status: "idle" },
  );

  const happyIndex = HAPPY_PATH.indexOf(status);

  return (
    <div className="rounded-[14px] border border-admin-border bg-admin-card p-6">
      <h4 className="font-serif text-[17px] font-semibold text-admin-primary">
        Andamento
      </h4>
      <p className="mt-1 text-[12.5px] text-admin-muted">{subtitle}</p>

      {happyIndex >= 0 ? (
        <div className="mt-5.5 flex items-center">
          {HAPPY_PATH.map((step, i) => (
            <Fragment key={step}>
              <TimelineStep
                label={statusLabel("service-request", step)}
                state={
                  i < happyIndex
                    ? "done"
                    : i === happyIndex
                      ? "current"
                      : "upcoming"
                }
              />
              {i < HAPPY_PATH.length - 1 && (
                <span
                  className={`mb-5 h-0.5 flex-1 ${
                    i < happyIndex ? "bg-admin-success-text" : "bg-admin-border"
                  }`}
                />
              )}
            </Fragment>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-[12.5px] text-admin-muted">
          Andamento atual:{" "}
          <strong className="text-admin-primary">
            {statusLabel("service-request", status)}
          </strong>
        </p>
      )}

      {suggested.length > 0 && (
        <div className="mt-5.5 flex flex-wrap items-center gap-2 border-t border-admin-border pt-4.5">
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
                className={suggestionPillClass(next)}
              >
                {statusLabel("service-request", next)}
              </button>
            </form>
          ))}
        </div>
      )}

      <details className="mt-3.5">
        <summary className="cursor-pointer text-[12px] font-semibold text-admin-muted">
          Corrigir para outro andamento
        </summary>
        <form action={action} className="mt-2.5 flex items-center gap-2.5">
          <input type="hidden" name="requestId" value={requestId} />
          <div className="relative">
            <select
              name="status"
              defaultValue={status}
              className="appearance-none rounded-[9px] border border-admin-input-border bg-admin-input-bg py-2 pr-9 pl-3 text-[13px] text-admin-text"
            >
              {SERVICE_REQUEST_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {statusLabel("service-request", s)}
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
            className="rounded-[9px] bg-admin-primary-soft px-4 py-2 text-[12.5px] font-bold text-white disabled:opacity-60"
          >
            Aplicar
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
