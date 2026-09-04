import type { ServiceRequestStatus } from "@/core/request/kinds.ts";

/**
 * The look of the andamento badge, by what the andamento asks of the office,
 * not by which phase it belongs to. The phases still group the queue and the
 * timeline, but they stopped explaining the colour: "Com exigência" and "Em
 * análise" share the analysis phase while meaning opposite things to whoever
 * is scanning the list for what stalled.
 *
 * Five tones, and every one of the nineteen andamentos names its own. A
 * `Record` with no fallback on purpose: a twentieth andamento fails the type
 * check instead of quietly inheriting a colour nobody chose for it.
 */
export type Tone = "blocked" | "waiting" | "working" | "delivered" | "closed";

const TONE_STYLES: Record<Tone, string> = {
  blocked: "bg-admin-error-bg text-admin-error-text",
  waiting: "bg-admin-warning-bg text-admin-warning-text",
  working: "bg-admin-success-bg text-admin-success-text",
  delivered: "bg-admin-primary text-white",
  closed: "bg-admin-readonly-bg text-admin-faint",
};

export const STATUS_TONES: Record<ServiceRequestStatus, Tone> = {
  // Stalled: someone has to act before this moves. "Indeferido" joins them as
  // the ending nobody wanted.
  "with-requirement": "blocked",
  "awaiting-compliance": "blocked",
  rejected: "blocked",
  // Waiting on the counter to pick it up, or on the citizen to pay. Money
  // pending is expected waiting; an exigência is an impediment, hence the
  // different tone.
  new: "waiting",
  filed: "waiting",
  "awaiting-payment": "waiting",
  // Work running inside the office.
  "in-review": "working",
  paid: "working",
  "pre-noted": "working",
  "in-qualification": "working",
  processing: "working",
  registered: "working",
  annotated: "working",
  granted: "working",
  // Done, in the office's own ink.
  "ready-for-pickup": "delivered",
  done: "delivered",
  // Over without delivery.
  cancelled: "closed",
  archived: "closed",
  // Off the board on purpose, by the operator's own hand.
  inactive: "closed",
};

export function statusBadgeClass(status: ServiceRequestStatus): string {
  return TONE_STYLES[STATUS_TONES[status]];
}
