import {
  phaseOfStatus,
  type ServiceRequestPhaseId,
  type ServiceRequestStatus,
} from "@/core/request/kinds.ts";

/**
 * One look per phase, not per andamento. With eighteen of them, a colour each
 * would be eighteen decisions to keep coherent and one more to forget every
 * time the list grows; the phase already says what the operator reads off the
 * badge: where in the request's life this is. Shared between the queue and
 * the detail screen so the two never drift.
 *
 * The exceptions are the ways a request ends: "Concluído" earns the office's
 * ink, and a refusal has to look different from a completion even though both
 * are the closed phase.
 */
const PHASE_STYLES: Record<ServiceRequestPhaseId, string> = {
  intake: "bg-admin-warning-bg text-admin-warning-text",
  analysis: "bg-admin-success-bg text-admin-success-text",
  payment: "bg-admin-warning-bg text-admin-warning-text",
  processing: "bg-admin-success-bg text-admin-success-text",
  delivery: "bg-admin-primary text-white",
  closed: "bg-admin-readonly-bg text-admin-muted",
};

const STATUS_OVERRIDES: Partial<Record<ServiceRequestStatus, string>> = {
  done: "bg-admin-primary text-white",
  rejected: "bg-admin-error-bg text-admin-error-text",
  archived: "bg-admin-readonly-bg text-admin-faint",
};

function styleFor(status: ServiceRequestStatus): string {
  return STATUS_OVERRIDES[status] ?? PHASE_STYLES[phaseOfStatus(status)];
}

export function StatusBadge({
  status,
  label,
}: {
  status: ServiceRequestStatus;
  label: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${styleFor(status)}`}
    >
      {label}
    </span>
  );
}
