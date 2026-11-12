"use client";

import { type ReactNode, useActionState, useEffect, useState } from "react";
import {
  MAX_DEADLINE_DAYS,
  MIN_DEADLINE_DAYS,
} from "@/core/request/deadline.ts";
import {
  isOpenServiceRequestStatus,
  PROGRESS_STEPS,
  progressOf,
  requiresStatusReason,
  SERVICE_REQUEST_PHASES,
  type ServiceRequestStatus,
  STATUS_GUIDANCE,
  statusLabel,
  stepStates,
  transitionLabel,
} from "@/core/request/kinds.ts";
import { LONG_TEXT_MAX } from "@/core/text-limits.ts";
import { AdminIcon } from "../../../../_components/icon.tsx";
import { useEmailWarning } from "../../../../_components/use-email-warning.ts";
import { STATUS_TONES, type Tone } from "../../_components/status-tone.ts";
import { type ActionState, changeStatus } from "../actions.ts";

/** The happy path the progress timeline draws. Off-ramps (Indeferido,
 * Cancelado, Arquivado) have no fixed position on it, so a request in one of
 * those falls back to the plain "andamento atual" line instead of a step. */
const HAPPY_PATH: readonly ServiceRequestStatus[] = [
  "new",
  "in-review",
  "awaiting-payment",
  "processing",
  "done",
];

/** A consulta (busca de registro) não passa por pagamento nem preparo: chega e
 * é respondida. */
export const CONSULTATION_PATH: readonly ServiceRequestStatus[] = [
  "new",
  "done",
];

/** A consulta que a serventia cobra, pela tabela de emolumentos: o
 * pagamento entra entre a chegada e a resposta. */
export const PAID_CONSULTATION_PATH: readonly ServiceRequestStatus[] = [
  "new",
  "awaiting-payment",
  "done",
];

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
        maxLength={LONG_TEXT_MAX}
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

/**
 * How far along the request is (decision of 12/11/2026): the steps of the
 * work joined by a line that fills as the request moves, the step it is in
 * marked and named, and the percent beside them. A consulta has fewer
 * steps: it is received, maybe paid, and answered.
 */
function ProgressSteps({
  status,
  happyPath,
}: {
  status: ServiceRequestStatus;
  happyPath: readonly ServiceRequestStatus[];
}) {
  const percent = progressOf(status);
  if (percent === null) return null;
  const steps = PROGRESS_STEPS.filter((step) =>
    happyPath === CONSULTATION_PATH
      ? step.id === "received" || step.id === "delivery"
      : happyPath === PAID_CONSULTATION_PATH
        ? step.id !== "analysis" && step.id !== "execution"
        : true,
  ).map((step) =>
    step.id === "delivery" && happyPath !== HAPPY_PATH
      ? { ...step, label: "Resposta" }
      : step,
  );
  const states = stepStates(steps, percent);
  const blocked = status === "awaiting-compliance";
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-bold tracking-[.14em] text-admin-muted uppercase">
          Etapas do pedido
        </span>
        <span className="text-[12.5px] text-admin-muted">
          <strong className="font-serif text-[20px] font-semibold text-admin-primary tabular-nums">
            {percent}%
          </strong>{" "}
          concluído
        </span>
      </div>
      <ol
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Andamento do pedido"
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`,
        }}
      >
        {steps.map((step, i) => {
          const state = states[i];
          const stopped = blocked && state === "current";
          const lineDone =
            states[i + 1] === "done" || states[i + 1] === "current";
          return (
            <li
              key={step.id}
              aria-current={state === "current" ? "step" : undefined}
              className="relative flex flex-col items-center gap-2 px-1 text-center"
            >
              {i < steps.length - 1 && (
                <span
                  aria-hidden="true"
                  className={`absolute top-[15px] left-1/2 h-[3px] w-full rounded-full ${
                    lineDone ? "bg-admin-primary" : "bg-admin-border"
                  }`}
                />
              )}
              <span
                className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-bold ${
                  state === "done"
                    ? "bg-admin-primary text-white"
                    : stopped
                      ? "bg-admin-error-text text-white ring-4 ring-admin-error-bg"
                      : state === "current"
                        ? "border-[3px] border-admin-primary bg-admin-card text-admin-primary ring-4 ring-admin-success-bg motion-safe:animate-attention-pulse-light"
                        : "border-2 border-admin-border bg-admin-card text-admin-faint"
                }`}
              >
                {state === "done" ? "✓" : stopped ? "!" : i + 1}
              </span>
              <span
                className={`text-[12.5px] leading-tight ${
                  state === "todo"
                    ? "font-medium text-admin-faint"
                    : "font-bold text-admin-primary"
                } ${state === "current" ? "" : "max-sm:sr-only"}`}
              >
                {step.label}
              </span>
              {state === "current" && (
                <span
                  className={`text-[11.5px] leading-tight font-semibold ${
                    stopped ? "text-admin-error-text" : "text-admin-accent"
                  } max-sm:hidden`}
                >
                  {statusLabel("service-request", status)}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

const HOLDER_LABELS = {
  office: "Com o cartório",
  applicant: "Com o solicitante",
} as const;

/**
 * The stage the request is in, said plainly (decision of 12/11/2026): its
 * name, who has it in hand, what it means and what is expected next.
 */
function CurrentStage({
  status,
  consultation,
}: {
  status: ServiceRequestStatus;
  consultation: boolean;
}) {
  const guidance = STATUS_GUIDANCE[status];
  const tone = STATUS_TONES[status];
  const next =
    consultation && isOpenServiceRequestStatus(status)
      ? "Responda à busca no quadro Resposta, logo abaixo: a resposta conclui o pedido."
      : guidance.next;
  return (
    <div
      className={`flex flex-col gap-2 rounded-[12px] border-l-4 px-5 py-4 ${STAGE_STYLES[tone]}`}
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="text-[11px] font-bold tracking-[.14em] text-admin-muted uppercase">
          Situação atual
        </span>
        {guidance.holder && (
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-bold ${
              guidance.holder === "office"
                ? "bg-admin-primary text-white"
                : "bg-admin-warning-bg text-admin-warning-text"
            }`}
          >
            {HOLDER_LABELS[guidance.holder]}
          </span>
        )}
      </div>
      <h3 className="font-serif text-[22px] leading-tight font-semibold text-admin-primary">
        {statusLabel("service-request", status)}
      </h3>
      <p className="text-[13.5px] leading-relaxed text-admin-text">
        {guidance.meaning}
      </p>
      <p className="text-[13px] leading-relaxed text-admin-muted">
        <strong className="font-semibold text-admin-primary">
          O que fazer agora:
        </strong>{" "}
        {next}
      </p>
    </div>
  );
}

/** The card's edge and tint, by what the andamento asks of the office. */
const STAGE_STYLES: Record<Tone, string> = {
  blocked: "border-admin-error-text bg-admin-error-bg/60",
  waiting: "border-admin-accent bg-admin-warning-bg/50",
  working: "border-admin-primary bg-admin-input-bg",
  delivered: "border-admin-primary bg-admin-success-bg/60",
  closed: "border-admin-border bg-admin-readonly-bg",
};

export function StatusSection({
  requestId,
  protocolNumber,
  status,
  subtitle,
  badges,
  suggested,
  deadlineSummary,
  deadlineDays,
  happyPath = HAPPY_PATH,
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
  /** A trilha desenhada no topo: a comum, ou a da consulta. */
  happyPath?: readonly ServiceRequestStatus[];
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

  // The steps forward are buttons; the two endings without delivery sit
  // apart, so "Cancelar o pedido" is never read as "desistir do clique".
  const forward = suggested.filter((s) => !requiresStatusReason(s));
  const closing = suggested.filter((s) => requiresStatusReason(s));
  const consultation = happyPath !== HAPPY_PATH;

  return (
    <div className="flex flex-col overflow-hidden rounded-[16px] border border-admin-border bg-admin-card shadow-[0_1px_2px_rgba(16,40,32,0.05)]">
      <header className="flex flex-col gap-2.5 border-b border-admin-border bg-admin-input-bg/60 px-7 pt-6 pb-5 max-md:px-4">
        <span className="text-[11px] font-bold tracking-[.16em] text-admin-accent uppercase">
          Andamento do pedido
        </span>
        <h2 className="font-serif text-[34px] leading-[1.05] font-semibold text-admin-primary tabular-nums max-md:text-[28px]">
          {protocolNumber}
        </h2>
        <p className="text-[14px] leading-normal text-admin-muted">
          {subtitle}
        </p>
        <div className="flex flex-wrap gap-2">{badges}</div>
      </header>

      <div className="flex flex-col gap-6 px-7 py-6 max-md:px-4">
        <ProgressSteps status={status} happyPath={happyPath} />
        <CurrentStage status={status} consultation={consultation} />

        {/* One form for both routes to a new andamento, so the term control
          below applies to whichever the operator uses. A button submits its
          own `status`; "Aplicar" submits none, and the action falls back to
          the correction select. */}
        <form action={action} className="flex flex-col gap-3.5">
          <input type="hidden" name="requestId" value={requestId} />

          {forward.length > 0 && (
            <div className="flex flex-col gap-2.5">
              <span className="text-[11px] font-bold tracking-[.14em] text-admin-muted uppercase">
                Próximo passo
              </span>
              <div className="flex flex-wrap items-center gap-2.5">
                {forward.map((next, i) => (
                  <button
                    key={next}
                    type="submit"
                    name="status"
                    value={next}
                    disabled={pending}
                    className={`btn btn-md px-5 py-2.5 text-[13.5px] ${i === 0 ? "btn-admin-primary shadow-sm" : "btn-admin-secondary"} max-sm:w-full max-sm:whitespace-normal`}
                  >
                    {transitionLabel(status, next)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-admin-border pt-3.5">
            {closing.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12.5px]">
                <span className="text-admin-muted">Encerrar sem entrega:</span>
                {closing.map((next) => (
                  <button
                    key={next}
                    type="button"
                    onClick={() => setReasonTarget(next)}
                    disabled={pending}
                    className={`font-semibold underline-offset-4 hover:underline disabled:opacity-60 ${
                      next === "rejected"
                        ? "text-admin-error-text"
                        : "text-admin-muted hover:text-admin-primary"
                    }`}
                  >
                    {transitionLabel(status, next)}
                  </button>
                ))}
              </div>
            )}
            <span className="flex-1" />
            <button
              type="button"
              onClick={() => setMoreOpen((open) => !open)}
              aria-expanded={moreOpen}
              className="inline-flex items-center gap-[5px] text-[12.5px] font-semibold text-admin-muted hover:text-admin-primary"
            >
              Prazo e correção do andamento
              <AdminIcon
                name="chevronDown"
                strokeWidth={2.2}
                className={`h-[13px] w-[13px] transition-transform duration-300 ${moreOpen ? "rotate-180" : ""}`}
              />
            </button>
          </div>

          {moreOpen && (
            <div
              className={`grid grid-cols-1 gap-x-7 gap-y-[18px] rounded-[11px] border border-admin-border bg-admin-input-bg px-[18px] py-4 ${
                deadlineSummary ? "md:grid-cols-2" : ""
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
                  deadlineSummary
                    ? "md:border-l md:border-admin-border md:pl-7"
                    : ""
                }`}
              >
                <span className={PANEL_TITLE}>
                  Corrigir para outro andamento
                </span>
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
                      requiresStatusReason(selectedOverride)
                        ? "button"
                        : "submit"
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
    </div>
  );
}
