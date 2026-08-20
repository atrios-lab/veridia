import { addDays, type IsoDate } from "../scheduling/calendar.ts";
import type { PublicationKind } from "./publication.ts";

// Legal notice period for marriage banns (proclamas de casamento).
const MARRIAGE_BANNS_NOTICE_DAYS = 15;

/**
 * The exit date the form pre-fills, given the entry date: 15 days later for
 * marriage banns (the edital's legal notice period), nothing for the other
 * two kinds, which have no statutory default. The operator can always
 * override before saving; the server never rejects a different date.
 */
export function defaultExpiry(
  kind: PublicationKind,
  publishAt: IsoDate,
): IsoDate | undefined {
  if (kind !== "marriageBanns") return undefined;
  return addDays(publishAt, MARRIAGE_BANNS_NOTICE_DAYS);
}
