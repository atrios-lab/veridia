import { toIsoDate } from "../scheduling/calendar.ts";
import { OFFICE_TIME_ZONE } from "../time/office-time.ts";

/**
 * The assistant is included for every office (decision of 15/11/2026), so
 * its cost is the platform's: each office has a monthly ceiling of answered
 * questions. Refusals for being off topic do not count; they never reach
 * the answering model.
 */
export const DEFAULT_MONTHLY_LIMIT = 300;

/** Conversations go this many months after their last message. */
export const CONVERSATION_RETENTION_MONTHS = 12;

/** The month a question counts in: "2026-11", on the office's clock. */
export function usageMonth(now: Date): string {
  return toIsoDate(now, OFFICE_TIME_ZONE).slice(0, 7);
}

/** The first day of the month after `month`, as "2026-12-01". */
export function nextMonthStart(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const nextYear = monthNumber === 12 ? year + 1 : year;
  const next = monthNumber === 12 ? 1 : monthNumber + 1;
  return `${nextYear}-${String(next).padStart(2, "0")}-01`;
}

/** The office's own ceiling, or the default when it has none. */
export function effectiveLimit(configured: number | null | undefined): number {
  return configured && configured > 0 ? configured : DEFAULT_MONTHLY_LIMIT;
}

export function isOverQuota(answered: number, limit: number): boolean {
  return answered >= limit;
}

/**
 * Whether a conversation whose last message is `lastMessageAt` is past its
 * keeping time. Counted in calendar months, so a conversation of 31/01
 * goes on the last day of the following January, never early.
 */
export function isConversationExpired(lastMessageAt: Date, now: Date): boolean {
  const limit = new Date(lastMessageAt);
  limit.setUTCMonth(limit.getUTCMonth() + CONVERSATION_RETENTION_MONTHS);
  return now.getTime() > limit.getTime();
}

/** The oldest last message a kept conversation may have right now. */
export function retentionCutoff(now: Date): Date {
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - CONVERSATION_RETENTION_MONTHS);
  return cutoff;
}
