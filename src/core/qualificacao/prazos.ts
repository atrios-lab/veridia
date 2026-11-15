import { deadlineDate } from "../request/deadline.ts";
import type { IsoDate, OfficeHolidays } from "../scheduling/calendar.ts";
import {
  ATTRIBUTIONS,
  type Attribution,
  currentRound,
  isAttribution,
  type QualificationData,
} from "./qualificacao.ts";

/**
 * The term to register or to return the título with the nota, by
 * attribution, counted in business days from the presentation (or from
 * the reapresentação, in a reexame), the start day excluded: the way the
 * panel counts every extrajudicial term (core/request/deadline). The law's
 * term is the suggestion; the office confirms it and sets its own where
 * the law sets none.
 */
export interface DeadlineRule {
  /** Business days; null: no term counted. */
  days: number | null;
  basis: string;
}

export const DEADLINE_DEFAULTS: Record<Attribution, DeadlineRule> = {
  rcpn: {
    days: null,
    basis:
      "Sem prazo geral para a qualificação na lei; a serventia define o seu.",
  },
  ri: {
    days: 10,
    basis:
      "Lei nº 6.015/1973, art. 188 (registro ou emissão da nota devolutiva), contado em dias úteis.",
  },
  notas: {
    days: null,
    basis: "Sem prazo legal para o exame do pedido; a serventia define o seu.",
  },
  rtd: {
    days: null,
    basis: "A serventia define o prazo, conferida a norma estadual.",
  },
  rcpj: {
    days: null,
    basis: "A serventia define o prazo, conferida a norma estadual.",
  },
  protesto: {
    days: 3,
    basis:
      "Lei nº 9.492/1997, art. 12 (registro do protesto em três dias úteis da protocolização).",
  },
};

/** The office's own terms, by attribution: a number, or null for none. */
export type DeadlineSettings = Partial<Record<Attribution, number | null>>;

export function parseDeadlineSettings(raw: unknown): DeadlineSettings {
  const result: DeadlineSettings = {};
  if (!raw || typeof raw !== "object") return result;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isAttribution(key)) continue;
    if (value === null) result[key] = null;
    else if (
      Number.isInteger(value) &&
      (value as number) >= 1 &&
      (value as number) <= 365
    ) {
      result[key] = value as number;
    }
  }
  return result;
}

export function ruleFor(
  attribution: Attribution,
  settings: DeadlineSettings,
): DeadlineRule & { own: boolean } {
  const base = DEADLINE_DEFAULTS[attribution];
  if (Object.hasOwn(settings, attribution)) {
    const days = settings[attribution] ?? null;
    return {
      days,
      basis: days === base.days ? base.basis : "Prazo definido pela serventia.",
      own: true,
    };
  }
  return { ...base, own: false };
}

export interface DeadlineState {
  due: IsoDate;
  /** Today past the due day. */
  late: boolean;
  /** Due today or on the next business day. */
  soon: boolean;
}

/**
 * The due day of the open round, or null when there is no term or the
 * round was already answered by a note.
 */
export function qualificationDeadline(
  data: QualificationData,
  settings: DeadlineSettings,
  today: IsoDate,
  holidays: OfficeHolidays = {},
): DeadlineState | null {
  const round = currentRound(data);
  if (round.result !== "aberta") return null;
  const { days } = ruleFor(data.attribution, settings);
  if (!days) return null;
  const start = round.n > 1 && round.date ? round.date : data.receivedOn;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return null;
  const due = deadlineDate(start, days, holidays);
  return {
    due,
    late: today > due,
    soon: today <= due && deadlineDate(today, 1, holidays) >= due,
  };
}

export const ATTRIBUTION_ORDER = Object.keys(ATTRIBUTIONS) as Attribution[];
