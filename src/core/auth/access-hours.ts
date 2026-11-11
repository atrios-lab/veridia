import { OFFICE_TIME_ZONE } from "@/core/time/office-time.ts";

/**
 * When the panel opens (decision of 11/11/2026): from 07:00 to 18:00,
 * office time, for everyone the Tabelião/Registrador has not released.
 * Outside it the panel shows that access is unavailable at this hour,
 * because of the personal data it holds (LGPD), and lets the person ask
 * for a release. The holder and the Átrios account are never blocked.
 */
export interface AccessHours {
  /** Off: the panel is open at any hour, for everyone. */
  enabled: boolean;
  /** "HH:mm", office time. */
  start: string;
  end: string;
  /** People released at any hour, until the holder takes it back. */
  always: string[];
  /** People released for a while: user id to the instant it ends. */
  until: Record<string, string>;
  /** Asked from the closed screen, waiting for the holder. */
  requests: AccessRequest[];
}

export interface AccessRequest {
  userId: string;
  name: string;
  reason: string;
  at: string;
}

export const DEFAULT_ACCESS_HOURS: AccessHours = {
  enabled: true,
  start: "07:00",
  end: "18:00",
  always: [],
  until: {},
  requests: [],
};

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export function validHours(start: string, end: string): boolean {
  return HHMM.test(start) && HHMM.test(end) && minutes(start) < minutes(end);
}

function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v) => typeof v === "string") : [];

export function parseAccessHours(raw: unknown): AccessHours {
  const value = (raw ?? {}) as Partial<AccessHours>;
  const start = typeof value.start === "string" ? value.start : "";
  const end = typeof value.end === "string" ? value.end : "";
  const okHours = validHours(start, end);
  const until: Record<string, string> = {};
  if (value.until && typeof value.until === "object") {
    for (const [id, at] of Object.entries(value.until)) {
      if (typeof at === "string" && !Number.isNaN(Date.parse(at))) {
        until[id] = at;
      }
    }
  }
  return {
    enabled: value.enabled !== false,
    start: okHours ? start : DEFAULT_ACCESS_HOURS.start,
    end: okHours ? end : DEFAULT_ACCESS_HOURS.end,
    always: strings(value.always),
    until,
    requests: Array.isArray(value.requests)
      ? value.requests.filter(
          (r): r is AccessRequest =>
            Boolean(r) &&
            typeof r.userId === "string" &&
            typeof r.at === "string",
        )
      : [],
  };
}

/** Minutes past midnight, office time. */
export function officeMinutes(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: OFFICE_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return get("hour") * 60 + get("minute");
}

export function withinHours(hours: AccessHours, now: Date): boolean {
  if (!hours.enabled) return true;
  const at = officeMinutes(now);
  return at >= minutes(hours.start) && at < minutes(hours.end);
}

/** The holder and the platform account never meet the closed panel. */
export function exemptRole(role: string): boolean {
  return role === "admin" || role === "superadmin";
}

export function released(
  hours: AccessHours,
  userId: string,
  now: Date,
): boolean {
  if (hours.always.includes(userId)) return true;
  const until = hours.until[userId];
  return Boolean(until && Date.parse(until) > now.getTime());
}

export function mayAccess(
  hours: AccessHours,
  role: string,
  userId: string,
  now: Date,
): boolean {
  return (
    exemptRole(role) || withinHours(hours, now) || released(hours, userId, now)
  );
}

/**
 * When today's window closes, for an open screen to know when to reload;
 * undefined when nothing closes for this person today.
 */
export function closesAt(
  hours: AccessHours,
  role: string,
  userId: string,
  now: Date,
): Date | undefined {
  if (!hours.enabled || exemptRole(role)) return undefined;
  if (hours.always.includes(userId)) return undefined;
  const release = hours.until[userId];
  const releaseEnd = release ? new Date(release) : undefined;
  if (releaseEnd && releaseEnd > now) return releaseEnd;
  if (!withinHours(hours, now)) return undefined;
  const left = minutes(hours.end) - officeMinutes(now);
  const end = new Date(now.getTime() + left * 60_000);
  end.setSeconds(0, 0);
  return end;
}

/** The end of today, office time (UTC-3): a release "só hoje". */
export function endOfOfficeDay(now: Date): Date {
  const left = 24 * 60 - officeMinutes(now);
  const end = new Date(now.getTime() + left * 60_000);
  end.setSeconds(0, 0);
  return end;
}

export const ACCESS_CLOSED_NOTICE =
  "Para proteger os dados pessoais tratados pela serventia (Lei Geral de Proteção de Dados Pessoais, Lei nº 13.709/2018, arts. 6º, VII, e 46), o painel só abre no horário de expediente definido pelo Tabelião/Registrador.";
