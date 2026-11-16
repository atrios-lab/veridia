/**
 * The citizen's ciência (decision of 16/11/2026): what the office put on a
 * request, and whether the citizen has seen it on the protocol consult and,
 * for a document, opened or downloaded it. The first moment of each is what
 * certifies the delivery.
 */

export type ViewTarget = "requirement" | "document" | "amount" | "answer";
export type ViewAction = "viewed" | "downloaded";

export interface ViewMark {
  target: ViewTarget;
  targetId: string;
  action: ViewAction;
}

export interface ViewRow extends ViewMark {
  firstAt: Date;
  lastAt: Date;
  times: number;
}

/** What one thing on the request has had from the citizen. */
export interface Ciencia {
  viewedAt?: Date;
  downloadedAt?: Date;
  lastAt?: Date;
  /** Times seen plus times opened. */
  times: number;
}

export type CienciaState = "unseen" | "seen" | "downloaded";

export function viewKey(target: ViewTarget, targetId: string): string {
  return `${target}:${targetId}`;
}

/** Every row of a request, folded by thing. */
export function cienciaByKey(rows: readonly ViewRow[]): Map<string, Ciencia> {
  const out = new Map<string, Ciencia>();
  for (const row of rows) {
    const key = viewKey(row.target, row.targetId);
    const current = out.get(key) ?? { times: 0 };
    if (row.action === "viewed") current.viewedAt = row.firstAt;
    else current.downloadedAt = row.firstAt;
    if (!current.lastAt || row.lastAt > current.lastAt) {
      current.lastAt = row.lastAt;
    }
    current.times += row.times;
    out.set(key, current);
  }
  return out;
}

/**
 * Opening or downloading a document is seeing it, even when the listing's
 * own mark is missing (a link followed straight from the e-mail).
 */
export function cienciaState(ciencia: Ciencia | undefined): CienciaState {
  if (!ciencia) return "unseen";
  if (ciencia.downloadedAt) return "downloaded";
  return ciencia.viewedAt ? "seen" : "unseen";
}

/** The first time the citizen had it in front of them. */
export function firstSeenAt(ciencia: Ciencia | undefined): Date | undefined {
  if (!ciencia) return undefined;
  const { viewedAt, downloadedAt } = ciencia;
  if (viewedAt && downloadedAt) {
    return viewedAt < downloadedAt ? viewedAt : downloadedAt;
  }
  return viewedAt ?? downloadedAt;
}

/**
 * What the consult puts in front of the citizen, as marks of "viewed": each
 * exigência, each document from the office, the amount (by value: a new
 * amount is a new thing to see) and the answer to a consultation.
 */
export function viewedMarks(shown: {
  requirementIds: readonly string[];
  documentIds: readonly string[];
  amountCents?: number | null;
  answeredAt?: string | null;
}): ViewMark[] {
  const marks: ViewMark[] = [];
  for (const id of new Set(shown.requirementIds)) {
    marks.push({ target: "requirement", targetId: id, action: "viewed" });
  }
  for (const id of new Set(shown.documentIds)) {
    marks.push({ target: "document", targetId: id, action: "viewed" });
  }
  if (shown.amountCents != null) {
    marks.push({
      target: "amount",
      targetId: String(shown.amountCents),
      action: "viewed",
    });
  }
  if (shown.answeredAt) {
    marks.push({
      target: "answer",
      targetId: shown.answeredAt,
      action: "viewed",
    });
  }
  return marks;
}

/** The citizen's own uploads are theirs: only the office's files count. */
export function isOfficeDocumentKind(kind: string): boolean {
  return kind === "office" || kind === "rejection-document";
}
