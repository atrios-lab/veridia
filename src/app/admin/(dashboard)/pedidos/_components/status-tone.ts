import type { ServiceRequestStatus } from "@/core/request/kinds.ts";

/**
 * The look of the andamento badge, by what the andamento asks of the office,
 * not by which phase it belongs to. The phases still group the queue and the
 * timeline, but they stopped explaining the colour: "Com exigência" and "Em
 * análise" share the analysis phase while meaning opposite things to whoever
 * is scanning the list for what stalled.
 *
 * Five tones, and every one of the twelve andamentos names its own. A
 * `Record` with no fallback on purpose: an eleventh andamento fails the
 * type check instead of quietly inheriting a colour nobody chose for it.
 */
export type Tone = "blocked" | "waiting" | "working" | "delivered" | "closed";

// Tinted, for a badge read up close (a row of the queue): the soft fill
// with a hairline of the tone, so the pill still shows on white.
const TONE_STYLES: Record<Tone, string> = {
  blocked: "border-destructive/30 bg-destructive-soft text-destructive",
  waiting: "border-warning/30 bg-warning-soft text-warning-text",
  working: "border-success/30 bg-success-soft text-success-text",
  delivered: "bg-primary text-primary-foreground",
  closed: "bg-muted text-muted-foreground",
};

// Solid, for a badge that has to be seen from across the screen (the detail
// header, the counter of a stage with requests in it): "destaque é cor
// cheia". Closed stays quiet even here: nothing is left to do.
const TONE_SOLID_STYLES: Record<Tone, string> = {
  blocked: "bg-destructive text-destructive-foreground",
  waiting: "bg-warning text-warning-foreground",
  working: "bg-success text-success-foreground",
  delivered: "bg-primary text-primary-foreground",
  closed: "bg-muted text-muted-foreground",
};

export const STATUS_TONES: Record<ServiceRequestStatus, Tone> = {
  // Stalled: someone has to act before this moves. "Indeferido" joins them as
  // the ending nobody wanted.
  "awaiting-compliance": "blocked",
  rejected: "blocked",
  // Waiting on the counter to pick it up, or on the citizen to pay. Money
  // pending is expected waiting; an exigência is an impediment, hence the
  // different tone.
  // Waiting on the citizen's signed requerimento, or the office's check of
  // a scan (decision of 12/11/2026).
  "awaiting-signed-form": "waiting",
  new: "waiting",
  "awaiting-payment": "waiting",
  "payment-reported": "waiting",
  // The guia goes to the fisco with its boleto: the party pays it there.
  "awaiting-guide-payment": "waiting",
  // Work running inside the office.
  "in-review": "working",
  processing: "working",
  // Done, in the office's own ink.
  "ready-for-pickup": "delivered",
  done: "delivered",
  // Over without delivery.
  cancelled: "closed",
  archived: "closed",
};

/** The tinted pill of a tone: the andamento badge in a row of the queue. */
export function toneClass(tone: Tone): string {
  return TONE_STYLES[tone];
}

/** The solid pill of a tone: a badge read from afar. */
export function toneSolidClass(tone: Tone): string {
  return TONE_SOLID_STYLES[tone];
}

export function statusBadgeClass(
  status: ServiceRequestStatus,
  solid = false,
): string {
  const tone = STATUS_TONES[status];
  return solid ? TONE_SOLID_STYLES[tone] : TONE_STYLES[tone];
}
