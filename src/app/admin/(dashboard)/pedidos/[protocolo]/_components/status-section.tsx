"use client";

import { type ReactNode, useActionState, useEffect, useState } from "react";
import {
  MAX_DEADLINE_DAYS,
  MIN_DEADLINE_DAYS,
} from "@/core/request/deadline.ts";
import {
  requiresStatusReason,
  SERVICE_REQUEST_PHASES,
  type ServiceRequestStatus,
  statusLabel,
} from "@/core/request/kinds.ts";
import { AdminIcon } from "../../../../_components/icon.tsx";
import { useEmailWarning } from "../../../../_components/use-email-warning.ts";
import { type ActionState, changeStatus } from "../actions.ts";

/** The happy path the progress timeline draws. Off-ramps (Indeferido,
 * Cancelado, Arquivado) have no fixed position on it, so a request in one of
 * those falls back to the plain "andamento atual" line instead of a step. */
const HAPPY_PATH: readonly ServiceRequestStatus[] = [
  "new",
  "awaiting-payment",
  "paid",
  "done",
];

/** Outline colour for a "mudar para" pill, matching what each destination
 * means: neutral for forward progress, red for a refusal, grey for a stop.
 * The first suggestion is the next step and gets the filled pill instead. */
function suggestionPillClass(status: ServiceRequestStatus): string {
  if (status === "rejected") {
    return "rounded-full border border-admin-error-border bg-admin-error-bg px-[13px] py-1.5 text-[12.5px] font-semibold text-admin-error-text disabled:opacity-60";
  }
  if (status === "cancelled") {
    return "rounded-full border border-admin-border bg-admin-readonly-bg px-[13px] py-1.5 text-[12.5px] font-semibold text-admin-muted disabled:opacity-60";
  }
  return "rounded-full border border-admin-input-border bg-admin-input-bg px-[13px] py-1.5 text-[12.5px] font-semibold text-admin-primary disabled:opacity-60";
}

const PANEL_TITLE = "text-[12px] font-bold text-admin-primary";
const PANEL_HELP = "text-[12.5px] text-admin-muted";

/**
 * The term control, offered on every andamento change because that is when
 * the office knows what the term is worth: the request just picked up for
 * analysis is the one whose clock should restart.
 *
 * "Manter" preselected, so the ordinary change stays one click. Only a
 * deliberate choice writes a term.
 */
function DeadlineControl({
  summary,
  days,
  pending,
}: {
  /** "até 27/09/2026 · dia 5 de 30" */
  summary: string;
  days: number;
  pending: boolean;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <span className={PANEL_TITLE}>Prazo</span>
      <span className={PANEL_HELP}>Hoje: {summary}</span>
      <fieldset className="flex flex-wrap items-center gap-x-3.5 gap-y-2.5 text-[12.5px] text-admin-text">
        <legend className="sr-only">Prazo do pedido</legend>
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            name="deadlineChoice"
            value="keep"
            defaultChecked
          />
          Manter
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" name="deadlineChoice" value="restart" />
          Recomeçar hoje
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" name="deadlineChoice" value="days" />
          Mudar para
          <input
            type="number"
            name="deadlineDays"
            defaultValue={days}
            min={MIN_DEADLINE_DAYS}
            max={MAX_DEADLINE_DAYS}
            step={1}
            inputMode="numeric"
            aria-label="Dias de prazo"
            className="w-[52px] rounded-lg border border-admin-input-border bg-admin-card px-2 py-1 text-center text-[12.5px] text-admin-text"
          />
          dias
        </label>
      </fieldset>
      <button
        type="submit"
        name="intent"
        value="deadline"
        disabled={pending}
        className="btn btn-admin-secondary btn-sm self-start"
      >
        {pending ? "Salvando…" : "Salvar prazo"}
      </button>
    </div>
  );
}

/**
 * The reason step for Cancelado/Indeferido: a cancellation with no why is
 * what makes the citizen call the counter to ask, so the andamento never
 * lands there off a bare click. Opened by whichever control (suggestion
 * pill or the correction select) aimed at one of the two, and its "Confirmar"
 * is the actual submitter: it carries `status` itself, so it wins over
 * `statusOverride` in the action regardless of which control opened it.
 */
function ReasonConfirmation({
  target,
  pending,
  onCancel,
}: {
  target: ServiceRequestStatus;
  pending: boolean;
  onCancel: () => void;
}) {
  const label = statusLabel("service-request", target).toLowerCase();
  const [fileName, setFileName] = useState<string | null>(null);
  // Only Indeferido may stand the reason in with a PDF instead of the text
  // (see design.md); Cancelado keeps the text as its only option.
  const allowsDocument = target === "rejected";
  return (
    <div className="flex flex-col gap-2.5 rounded-[11px] border border-admin-error-border bg-admin-error-bg px-[18px] py-4">
      <span className={PANEL_TITLE}>Motivo</span>
      <span className={PANEL_HELP}>
        {allowsDocument
          ? "O cidadão vê o motivo, o documento, ou os dois, na consulta de protocolo."
          : "O cidadão vê este motivo na consulta de protocolo."}
      </span>
      <textarea
        name="reason"
        required={!allowsDocument}
        rows={3}
        aria-label={`Motivo para mudar o andamento para ${label}`}
        placeholder={`Explique por que o pedido está sendo ${label === "indeferido" ? "indeferido" : "cancelado"}.`}
        className="w-full rounded-[9px] border border-admin-input-border bg-admin-card px-3 py-2 text-[13px] text-admin-text"
      />
      {allowsDocument && (
        <div className="flex flex-col gap-1.5">
          <span className={PANEL_HELP}>
            Ou anexe um PDF com a justificativa, em vez do texto (ou junto
            dele).
          </span>
          <label
            className={`relative flex cursor-pointer items-center justify-center gap-2 rounded-[9px] border-[1.5px] border-dashed border-admin-input-border px-3 py-2 text-center text-[12px] font-semibold text-admin-primary ${pending ? "cursor-not-allowed opacity-60" : ""}`}
          >
            {fileName ?? "Anexar PDF do indeferimento"}
            <input
              type="file"
              name="rejectionDocument"
              accept="application/pdf"
              className="sr-only"
              disabled={pending}
              onChange={(event) =>
                setFileName(event.target.files?.[0]?.name ?? null)
              }
            />
          </label>
        </div>
      )}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          name="status"
          value={target}
          disabled={pending}
          className="btn btn-admin-secondary btn-sm"
        >
          {pending ? "Confirmando…" : `Confirmar ${label}`}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="text-[12.5px] font-semibold text-admin-muted hover:text-admin-primary"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

export function StatusSection({
  requestId,
  protocolNumber,
  status,
  subtitle,
  badges,
  suggested,
  deadlineSummary,
  deadlineDays,
}: {
  requestId: string;
  protocolNumber: string;
  status: ServiceRequestStatus;
  /** "{ato} · {solicitante} · pedido em {data}" */
  subtitle: string;
  /** The status, term and exemption pills, rendered by the page. */
  badges: ReactNode;
  suggested: readonly ServiceRequestStatus[];
  /** "até 27/09/2026 · dia 5 de 30", or null once the request is closed. */
  deadlineSummary: string | null;
  deadlineDays: number;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    changeStatus,
    { status: "idle" },
  );
  useEmailWarning(state);
  // The term and the correction are the rare moves; the next step is not.
  const [moreOpen, setMoreOpen] = useState(false);
  // Which andamento (Cancelado/Indeferido) is waiting on a reason before it
  // can be confirmed, from whichever control aimed at it. `null` the rest of
  // the time, when every other andamento applies on the first click.
  const [reasonTarget, setReasonTarget] = useState<ServiceRequestStatus | null>(
    null,
  );
  const [selectedOverride, setSelectedOverride] =
    useState<ServiceRequestStatus>(status);

  useEffect(() => {
    if (state.status === "success") setReasonTarget(null);
  }, [state.status]);

  const happyIndex = HAPPY_PATH.indexOf(status);

  return (
    <div className="flex flex-col gap-[26px] rounded-[14px] border border-admin-border bg-admin-card px-7 pt-[30px] pb-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="text-[11px] font-bold tracking-[.16em] text-admin-accent uppercase">
          Andamento do pedido
        </span>
        <h2 className="font-serif text-[38px] leading-[1.05] font-semibold text-admin-primary tabular-nums">
          {protocolNumber}
        </h2>
        <p className="text-[14px] leading-normal text-admin-muted">
          {subtitle}
        </p>
        <div className="mt-1 flex flex-wrap justify-center gap-2">{badges}</div>
      </div>

      {happyIndex >= 0 ? (
        <div className="grid grid-cols-5 gap-2.5">
          {HAPPY_PATH.map((step, i) => (
            <div key={step} className="flex flex-col items-center gap-2.5">
              <div className="h-[5px] w-full overflow-hidden rounded-full bg-admin-border">
                <div
                  className={`h-full rounded-full bg-admin-primary-soft ${
                    i < happyIndex || (i === happyIndex && step === "done")
                      ? "w-full"
                      : i === happyIndex
                        ? "w-1/2"
                        : "w-0"
                  }`}
                />
              </div>
              <span
                className={`text-center text-[12.5px] leading-[1.3] ${
                  i < happyIndex
                    ? "font-bold text-admin-text"
                    : i === happyIndex
                      ? "font-bold text-admin-primary-soft"
                      : "font-medium text-admin-faint"
                }`}
              >
                {statusLabel("service-request", step)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[12.5px] text-admin-muted">
          Andamento atual:{" "}
          <strong className="text-admin-primary">
            {statusLabel("service-request", status)}
          </strong>
        </p>
      )}

      {/* One form for both routes to a new andamento, so the term control
          below applies to whichever the operator uses. A pill submits its own
          `status`; "Aplicar" submits none, and the action falls back to the
          correction select. */}
      <form
        action={action}
        className="flex flex-col gap-3.5 border-t border-admin-border pt-[18px]"
      >
        <input type="hidden" name="requestId" value={requestId} />

        <div className="flex flex-wrap items-center gap-2.5">
          {suggested.length > 0 && (
            <span className="text-[12px] font-bold text-admin-primary">
              Mudar para
            </span>
          )}
          {suggested.map((next, i) => {
            const dangerous = requiresStatusReason(next);
            return (
              <button
                key={next}
                type={dangerous ? "button" : "submit"}
                name={dangerous ? undefined : "status"}
                value={dangerous ? undefined : next}
                onClick={dangerous ? () => setReasonTarget(next) : undefined}
                disabled={pending}
                className={
                  i === 0
                    ? "rounded-full bg-admin-primary px-3.5 py-[7px] text-[12.5px] font-semibold text-white disabled:opacity-60"
                    : suggestionPillClass(next)
                }
              >
                {statusLabel("service-request", next)}
              </button>
            );
          })}
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => setMoreOpen((open) => !open)}
            aria-expanded={moreOpen}
            className="inline-flex items-center gap-[5px] text-[12.5px] font-semibold text-admin-muted hover:text-admin-primary"
          >
            Prazo e correção
            <AdminIcon
              name="chevronDown"
              strokeWidth={2.2}
              className={`h-[13px] w-[13px] transition-transform duration-300 ${moreOpen ? "rotate-180" : ""}`}
            />
          </button>
        </div>

        {moreOpen && (
          <div
            className={`grid gap-x-7 gap-y-[18px] rounded-[11px] border border-admin-border bg-admin-input-bg px-[18px] py-4 ${
              deadlineSummary ? "grid-cols-2" : "grid-cols-1"
            }`}
          >
            {deadlineSummary && (
              <DeadlineControl
                summary={deadlineSummary}
                days={deadlineDays}
                pending={pending}
              />
            )}
            <div
              className={`flex flex-col gap-2.5 ${
                deadlineSummary ? "border-l border-admin-border pl-7" : ""
              }`}
            >
              <span className={PANEL_TITLE}>Corrigir para outro andamento</span>
              <span className={PANEL_HELP}>
                Para quando o pedido foi lançado na etapa errada.
              </span>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <select
                    name="statusOverride"
                    value={selectedOverride}
                    onChange={(e) =>
                      setSelectedOverride(
                        e.target.value as ServiceRequestStatus,
                      )
                    }
                    aria-label="Corrigir para outro andamento"
                    className="w-full appearance-none rounded-[9px] border border-admin-input-border bg-admin-card py-2 pr-9 pl-3 text-[13px] text-admin-text"
                  >
                    {/* Grouped by phase: eighteen flat options is a wall, and
                        the operator is looking for a step of the title's life,
                        which is exactly what the groups name. */}
                    {SERVICE_REQUEST_PHASES.map((phase) => (
                      <optgroup key={phase.id} label={phase.label}>
                        {phase.statuses.map((s) => (
                          <option key={s} value={s}>
                            {statusLabel("service-request", s)}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <AdminIcon
                    name="chevronDown"
                    className="pointer-events-none absolute top-1/2 right-3 h-[13px] w-[13px] -translate-y-1/2 text-admin-muted"
                    strokeWidth={2}
                  />
                </div>
                <button
                  type={
                    requiresStatusReason(selectedOverride) ? "button" : "submit"
                  }
                  onClick={
                    requiresStatusReason(selectedOverride)
                      ? () => setReasonTarget(selectedOverride)
                      : undefined
                  }
                  disabled={pending}
                  className="btn btn-admin-secondary btn-sm"
                >
                  {pending ? "Aplicando…" : "Aplicar"}
                </button>
              </div>
            </div>
          </div>
        )}

        {reasonTarget && (
          <ReasonConfirmation
            target={reasonTarget}
            pending={pending}
            onCancel={() => setReasonTarget(null)}
          />
        )}

        {state.status === "error" && (
          <p
            role="alert"
            className="text-[12.5px] font-semibold text-admin-error-text"
          >
            {state.message}
          </p>
        )}
      </form>
    </div>
  );
}
