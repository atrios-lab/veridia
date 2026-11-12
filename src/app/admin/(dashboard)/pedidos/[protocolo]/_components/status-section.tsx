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
import { Badge } from "../../../../_ui/badge.tsx";
import { Button } from "../../../../_ui/button.tsx";
import { Input } from "../../../../_ui/input.tsx";
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "../../../../_ui/native-select.tsx";
import { Progress } from "../../../../_ui/progress.tsx";
import { Textarea } from "../../../../_ui/textarea.tsx";
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

const PANEL_TITLE = "text-sm font-medium text-foreground";
const PANEL_HELP = "text-sm text-muted-foreground";
/** A small heading inside the card: a caption, not a shouted overline. */
const CAPTION = "text-xs font-medium text-muted-foreground";

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
    <div className="flex flex-col gap-2">
      <span className={PANEL_TITLE}>Prazo</span>
      <span className={PANEL_HELP}>Hoje: {summary}</span>
      <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-foreground">
        <legend className="sr-only">Prazo do pedido</legend>
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            name="deadlineChoice"
            value="keep"
            defaultChecked
            className="size-4 accent-primary"
          />
          Manter
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            name="deadlineChoice"
            value="restart"
            className="size-4 accent-primary"
          />
          Recomeçar hoje
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            name="deadlineChoice"
            value="days"
            className="size-4 accent-primary"
          />
          Mudar para
          <Input
            type="number"
            name="deadlineDays"
            defaultValue={days}
            min={MIN_DEADLINE_DAYS}
            max={MAX_DEADLINE_DAYS}
            step={1}
            inputMode="numeric"
            aria-label="Dias de prazo"
            className="h-8 w-16 px-2 text-center"
          />
          dias
        </label>
      </fieldset>
      <Button
        type="submit"
        name="intent"
        value="deadline"
        variant="outline"
        size="sm"
        disabled={pending}
        className="self-start"
      >
        {pending ? "Salvando…" : "Salvar prazo"}
      </Button>
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
    <div className="flex flex-col gap-2 rounded-lg border border-destructive/40 bg-destructive-soft p-4">
      <span className={PANEL_TITLE}>Motivo</span>
      <span className={PANEL_HELP}>
        {allowsDocument
          ? "O cidadão vê o motivo, o documento, ou os dois, na consulta de protocolo."
          : "O cidadão vê este motivo na consulta de protocolo."}
      </span>
      <Textarea
        name="reason"
        required={!allowsDocument}
        rows={3}
        maxLength={LONG_TEXT_MAX}
        aria-label={`Motivo para mudar o andamento para ${label}`}
        placeholder={`Explique por que o pedido está sendo ${label === "indeferido" ? "indeferido" : "cancelado"}.`}
        className="bg-background"
      />
      {allowsDocument && (
        <div className="flex flex-col gap-1.5">
          <span className={PANEL_HELP}>
            Ou anexe um PDF com a justificativa, em vez do texto (ou junto
            dele).
          </span>
          <label
            className={`relative flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-input bg-background px-3 py-2 text-center text-sm font-medium text-primary transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 hover:bg-muted/50 ${pending ? "cursor-not-allowed opacity-60" : ""}`}
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
        <Button
          type="submit"
          name="status"
          value={target}
          variant="outline"
          size="sm"
          disabled={pending}
        >
          {pending ? "Confirmando…" : `Confirmar ${label}`}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={pending}
          className="text-muted-foreground"
        >
          Cancelar
        </Button>
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
      {/* The percent as a bar: `Progress` carries the progressbar role and
          its value; the steps under it are the list of what that means. */}
      <Progress
        value={percent}
        aria-label="Andamento do pedido"
        className="items-baseline gap-x-3 gap-y-2"
      >
        <span className={CAPTION}>Etapas do pedido</span>
        <span className="ml-auto text-sm text-muted-foreground">
          <strong className="text-xl font-semibold text-foreground tabular-nums">
            {percent}%
          </strong>{" "}
          concluído
        </span>
      </Progress>
      <ol
        aria-label="Etapas do pedido"
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
                  className={`absolute top-3.5 left-1/2 h-0.5 w-full rounded-full ${
                    lineDone ? "bg-primary" : "bg-border"
                  }`}
                />
              )}
              <span
                className={`relative z-10 flex size-8 items-center justify-center rounded-full text-sm font-semibold tabular-nums ${
                  state === "done"
                    ? "bg-primary text-primary-foreground"
                    : stopped
                      ? "bg-destructive text-destructive-foreground ring-4 ring-destructive-soft"
                      : state === "current"
                        ? "border-2 border-primary bg-card text-primary ring-4 ring-primary/10 motion-safe:animate-attention-pulse-light"
                        : "border-2 border-border bg-card text-muted-foreground"
                }`}
              >
                {state === "done" ? "✓" : stopped ? "!" : i + 1}
              </span>
              <span
                className={`text-sm leading-tight ${
                  state === "todo"
                    ? "font-normal text-muted-foreground"
                    : "font-medium text-foreground"
                } ${state === "current" ? "" : "max-sm:sr-only"}`}
              >
                {step.label}
              </span>
              {state === "current" && (
                <span
                  className={`text-xs leading-tight font-medium ${
                    stopped ? "text-destructive" : "text-primary"
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
      className={`flex flex-col gap-2 rounded-lg border-l-4 px-5 py-4 ${STAGE_STYLES[tone]}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className={CAPTION}>Situação atual</span>
        {guidance.holder && (
          <Badge
            className={
              guidance.holder === "office"
                ? "bg-primary text-primary-foreground"
                : "bg-warning text-warning-foreground"
            }
          >
            {HOLDER_LABELS[guidance.holder]}
          </Badge>
        )}
      </div>
      <h3 className="text-xl leading-tight font-semibold text-foreground">
        {statusLabel("service-request", status)}
      </h3>
      <p className="text-sm leading-relaxed text-foreground">
        {guidance.meaning}
      </p>
      <p className="text-sm leading-relaxed text-muted-foreground">
        <strong className="font-semibold text-foreground">
          O que fazer agora:
        </strong>{" "}
        {next}
      </p>
    </div>
  );
}

/** The card's edge and tint, by what the andamento asks of the office. */
const STAGE_STYLES: Record<Tone, string> = {
  blocked: "border-destructive bg-destructive-soft",
  waiting: "border-warning bg-warning-soft",
  working: "border-success bg-success-soft",
  delivered: "border-primary bg-muted/50",
  closed: "border-border bg-muted",
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
    <div className="flex flex-col overflow-hidden rounded-xl border bg-card shadow-xs">
      <header className="flex flex-col gap-2 border-b bg-muted/50 px-6 pt-6 pb-5 max-md:px-4">
        <span className={CAPTION}>Andamento do pedido</span>
        <h2 className="text-2xl leading-tight font-semibold text-foreground tabular-nums">
          {protocolNumber}
        </h2>
        <p className="text-sm leading-normal text-muted-foreground">
          {subtitle}
        </p>
        <div className="flex flex-wrap gap-2">{badges}</div>
      </header>

      <div className="flex flex-col gap-6 px-6 py-6 max-md:px-4">
        <ProgressSteps status={status} happyPath={happyPath} />
        <CurrentStage status={status} consultation={consultation} />

        {/* One form for both routes to a new andamento, so the term control
          below applies to whichever the operator uses. A button submits its
          own `status`; "Aplicar" submits none, and the action falls back to
          the correction select. */}
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="requestId" value={requestId} />

          {forward.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className={CAPTION}>Próximo passo</span>
              <div className="flex flex-wrap items-center gap-2">
                {forward.map((next, i) => (
                  <Button
                    key={next}
                    type="submit"
                    name="status"
                    value={next}
                    size="lg"
                    variant={i === 0 ? "default" : "outline"}
                    disabled={pending}
                    className="px-4 max-sm:h-auto max-sm:min-h-10 max-sm:w-full max-sm:whitespace-normal"
                  >
                    {transitionLabel(status, next)}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-4">
            {closing.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
                <span className="text-muted-foreground">
                  Encerrar sem entrega:
                </span>
                {closing.map((next) => (
                  <button
                    key={next}
                    type="button"
                    onClick={() => setReasonTarget(next)}
                    disabled={pending}
                    className={`cursor-pointer font-medium underline-offset-4 hover:underline disabled:opacity-60 ${
                      next === "rejected"
                        ? "text-destructive"
                        : "text-muted-foreground hover:text-foreground"
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
              className="inline-flex cursor-pointer items-center gap-1 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Prazo e correção do andamento
              <AdminIcon
                name="chevronDown"
                strokeWidth={2.2}
                className={`size-3.5 transition-transform duration-300 ${moreOpen ? "rotate-180" : ""}`}
              />
            </button>
          </div>

          {moreOpen && (
            <div
              className={`grid grid-cols-1 gap-x-8 gap-y-4 rounded-lg border bg-muted/50 p-4 ${
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
                className={`flex flex-col gap-2 ${
                  deadlineSummary ? "md:border-l md:pl-8" : ""
                }`}
              >
                <span className={PANEL_TITLE}>
                  Corrigir para outro andamento
                </span>
                <span className={PANEL_HELP}>
                  Para quando o pedido foi lançado na etapa errada.
                </span>
                <div className="flex items-center gap-2">
                  <NativeSelect
                    name="statusOverride"
                    value={selectedOverride}
                    onChange={(e) =>
                      setSelectedOverride(
                        e.target.value as ServiceRequestStatus,
                      )
                    }
                    aria-label="Corrigir para outro andamento"
                    className="w-full flex-1 bg-background"
                  >
                    {/* Grouped by phase: eighteen flat options is a wall, and
                        the operator is looking for a step of the title's life,
                        which is exactly what the groups name. */}
                    {SERVICE_REQUEST_PHASES.map((phase) => (
                      <NativeSelectOptGroup key={phase.id} label={phase.label}>
                        {phase.statuses.map((s) => (
                          <NativeSelectOption key={s} value={s}>
                            {statusLabel("service-request", s)}
                          </NativeSelectOption>
                        ))}
                      </NativeSelectOptGroup>
                    ))}
                  </NativeSelect>
                  <Button
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
                    variant="outline"
                    disabled={pending}
                  >
                    {pending ? "Aplicando…" : "Aplicar"}
                  </Button>
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
            <p role="alert" className="text-sm font-medium text-destructive">
              {state.message}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
