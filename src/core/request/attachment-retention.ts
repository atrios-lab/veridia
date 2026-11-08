import { addDays, type IsoDate } from "../scheduling/calendar.ts";

/**
 * How long a protocol's files are kept: while the protocol is open, and 30
 * days after it closes. A file sent after the closing (the office attaching
 * a late document to a finished request) gets 30 days from its own sending.
 * After that only the record stays: name, kind, size, when it came and when
 * it went. The bytes are deleted from storage.
 *
 * It covers every file of every kind of protocol (service request, data
 * rights, ombudsman): what the citizen sent, the signed copies, the payment
 * receipt, the delivered document, the rejection document, the requirement's
 * form and whatever rode along its messages. Nothing goes while the protocol
 * is open, so a requirement's answer is never pulled from under the office.
 *
 * The 30 days are the platform's rule, the same window the publications'
 * files have (see `../publications/attachment-retention.ts`), not a number
 * from the law. What the law asks (LGPD, art. 6º, III, and arts. 15 and 16)
 * is that personal data not be kept past its purpose; a request's purpose
 * ends when it closes, and the office keeps in its own records whatever the
 * registry law tells it to keep.
 *
 * Decided with the user on 2026-11-08: see the design of the change
 * `expurgar-arquivos-dos-pedidos`.
 */
export const REQUEST_FILE_RETENTION_DAYS = 30;

/** What a link to a file this rule removed answers, panel and site alike. */
export const REQUEST_FILE_GONE =
  "Este arquivo foi apagado 30 dias depois do encerramento do protocolo.";

/** Warn the office this many days before the files go. */
export const REQUEST_FILE_WARNING_DAYS = 7;

export type RequestFileStatus =
  /** No file was ever stored on this row. */
  | { kind: "none" }
  /** The protocol is open: kept, with no end date yet. */
  | { kind: "held" }
  /** Closed, within its 30 days. */
  | { kind: "available"; until: IsoDate; daysLeft: number }
  /** Closed, past its 30 days: due to be deleted. */
  | { kind: "expired"; until: IsoDate }
  /** Already deleted; the row says when. */
  | { kind: "purged" };

/**
 * The last day a file is kept: 30 days after the later of the closing and
 * the file's own sending.
 */
export function requestFileAvailableUntil(
  closedOn: IsoDate,
  uploadedOn: IsoDate,
): IsoDate {
  const from = uploadedOn > closedOn ? uploadedOn : closedOn;
  return addDays(from, REQUEST_FILE_RETENTION_DAYS);
}

export function requestFileStatus(
  file: {
    hasFile: boolean;
    purged: boolean;
    /** The office's day the file was sent. */
    uploadedOn: IsoDate;
    /** The office's day the protocol closed; null while it is open. */
    closedOn: IsoDate | null;
  },
  today: IsoDate,
): RequestFileStatus {
  if (file.purged) return { kind: "purged" };
  if (!file.hasFile) return { kind: "none" };
  if (!file.closedOn) return { kind: "held" };
  const until = requestFileAvailableUntil(file.closedOn, file.uploadedOn);
  if (today <= until) {
    return { kind: "available", until, daysLeft: daysBetween(today, until) };
  }
  return { kind: "expired", until };
}

/** Whether the file can still be served (to the citizen or the panel). */
export function requestFileServable(status: RequestFileStatus): boolean {
  return status.kind === "held" || status.kind === "available";
}

/** Within the last days before the files go: the panel warns. */
export function requestFileDueSoon(status: RequestFileStatus): boolean {
  return (
    status.kind === "available" && status.daysLeft <= REQUEST_FILE_WARNING_DAYS
  );
}

function daysBetween(from: IsoDate, to: IsoDate): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}
