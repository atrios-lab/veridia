import { addDays, type IsoDate } from "../scheduling/calendar.ts";
import type { PublicationState } from "./state.ts";

/**
 * How long a publication's file (the PDF or the image) is kept: 30 days
 * from the day it was sent, the same window the platform promises for the
 * documents of a service request. After that only the written record stays:
 * kind, title, text, dates, who did what. The file is deleted from storage.
 *
 * The 30 days are the platform's rule, not a number from the law. What the
 * law asks (LGPD, art. 6º, III, and arts. 15 and 16) is that personal data
 * not be kept past its purpose; an edital's file usually carries names,
 * CPFs and addresses, and the office keeps its own copy in its own cloud.
 */
export const ATTACHMENT_RETENTION_DAYS = 30;

/** Warn the office this many days before the file goes. */
export const ATTACHMENT_WARNING_DAYS = 7;

export type AttachmentStatus =
  /** No file was ever attached. */
  | { kind: "none" }
  /** Within its 30 days. */
  | { kind: "available"; until: IsoDate; daysLeft: number }
  /**
   * Past its 30 days, but the publication is on the site right now: the
   * file stays until it leaves, so an edital whose legal term is still
   * running never loses its document in the middle of it.
   */
  | { kind: "held"; until: IsoDate }
  /** Past its 30 days and off the site: due to be deleted. */
  | { kind: "expired"; until: IsoDate }
  /** Already deleted; the record says when. */
  | { kind: "purged" };

/** The last day the file is kept: the upload day plus 30. */
export function attachmentAvailableUntil(uploadedOn: IsoDate): IsoDate {
  return addDays(uploadedOn, ATTACHMENT_RETENTION_DAYS);
}

export function attachmentStatus(
  pub: {
    hasFile: boolean;
    /** The office's day the current file was sent. */
    uploadedOn: IsoDate | null;
    purged: boolean;
    state: PublicationState;
  },
  today: IsoDate,
): AttachmentStatus {
  if (!pub.hasFile) return pub.purged ? { kind: "purged" } : { kind: "none" };
  // A file from before this rule has no upload day; the migration gives
  // every such file its 30 days from the deploy, so this is only a guard.
  if (!pub.uploadedOn) {
    return { kind: "available", until: today, daysLeft: 0 };
  }
  const until = attachmentAvailableUntil(pub.uploadedOn);
  if (today <= until) {
    return { kind: "available", until, daysLeft: daysBetween(today, until) };
  }
  if (pub.state === "live") return { kind: "held", until };
  return { kind: "expired", until };
}

/** Whether the file can still be served (to the site or the panel). */
export function attachmentServable(status: AttachmentStatus): boolean {
  return status.kind === "available" || status.kind === "held";
}

function daysBetween(from: IsoDate, to: IsoDate): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}
