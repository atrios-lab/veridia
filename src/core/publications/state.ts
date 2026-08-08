import type { IsoDate } from "../scheduling/calendar.ts";
import type { Publication } from "./publication.ts";

/**
 * The four tabs the panel shows. Every one is computed from dates at read
 * time — see design.md, "Estado é sempre calculado, nunca gravado por uma
 * tarefa" — never written by a background job.
 */
export const PUBLICATION_STATES = [
  "draft",
  "scheduled",
  "live",
  "archived",
] as const;
export type PublicationState = (typeof PUBLICATION_STATES)[number];

/**
 * Manual archiving wins over any date. Otherwise: no entry date is a draft,
 * an exit date already passed is archived (automatic expiry, no write), an
 * entry date still ahead is scheduled, and anything else — entry date
 * reached, exit date not yet reached — is live.
 */
export function publicationState(
  pub: Pick<Publication, "publishAt" | "expireAt" | "archivedAt">,
  today: IsoDate,
): PublicationState {
  if (pub.archivedAt) return "archived";
  if (!pub.publishAt) return "draft";
  if (pub.expireAt && pub.expireAt < today) return "archived";
  if (pub.publishAt > today) return "scheduled";
  return "live";
}

export function isLive(
  pub: Pick<Publication, "publishAt" | "expireAt" | "archivedAt">,
  today: IsoDate,
): boolean {
  return publicationState(pub, today) === "live";
}
