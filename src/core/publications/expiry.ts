import type { IsoDate } from "../scheduling/calendar.ts";
import { noticeSchedule } from "./notice-schedule.ts";
import { noticeTypeOf } from "./notice-types.ts";

/**
 * The exit date the form pre-fills, given the edital's type and its first
 * publication: the last day of the legal term, after every run the law asks
 * for (see NOTICE_TYPES). Nothing for a notice or an edital with no rule in
 * the catalog: there is no statutory default to suggest. The operator can
 * always override before saving; the server never rejects a different date.
 */
export function defaultExpiry(
  noticeType: string | null | undefined,
  publishAt: IsoDate,
): IsoDate | undefined {
  const type = noticeTypeOf(noticeType);
  if (!type) return undefined;
  return noticeSchedule(type, publishAt).termEndsOn;
}
