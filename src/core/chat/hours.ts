import {
  addDays,
  type IsoDate,
  isBusinessDay,
  longWeekday,
  nextBusinessDays,
  toIsoDate,
} from "../scheduling/calendar.ts";
import {
  type CounterHours,
  clockToMinutes,
  type Tenant,
} from "../tenant/schema.ts";
import { OFFICE_TIME_ZONE } from "../time/office-time.ts";

/** A wall-clock time on the office's own clock. */
export type ClockTime = { hour: number; minute: number };

function minutesInZone(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(instant);
  const part = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return part("hour") * 60 + part("minute");
}

function toClock(minutes: number): ClockTime {
  return { hour: Math.floor(minutes / 60), minute: minutes % 60 };
}

/** "8h", "13h30": the way the office's own sentence writes a time. */
export function formatClock({ hour, minute }: ClockTime): string {
  return minute === 0
    ? `${hour}h`
    : `${hour}h${String(minute).padStart(2, "0")}`;
}

/**
 * The counter's open spans on a business day, as `[start, end)` minutes
 * since midnight: one span, or two around the lunch break.
 */
export function counterIntervals(
  hours: CounterHours,
): [start: number, end: number][] {
  const open = hours.startHour * 60;
  const close = hours.endHour * 60;
  if (!hours.lunchBreak) return [[open, close]];
  return [
    [open, clockToMinutes(hours.lunchBreak.start)],
    [clockToMinutes(hours.lunchBreak.end), close],
  ];
}

/**
 * Whether the chat is inside the office's attendance window right now: a
 * business day (see `isBusinessDay`, weekday and not a national holiday) and
 * the wall clock inside `tenant.counterHours`, the hours the counter itself
 * keeps, lunch break excluded. Chat hours are not a separate setting, see
 * support-chat spec, "Horário do chat segue o horário de atendimento
 * configurado". Note this is the counter's window, not the appointment grid:
 * an office open every day may receive by appointment on Tuesdays only.
 */
export function isWithinChatHours(
  tenant: Tenant,
  now: Date,
  timeZone: string = OFFICE_TIME_ZONE,
): boolean {
  return counterStatus(tenant, now, timeZone).open;
}

/**
 * Where the counter stands right now, and what changes next.
 *
 * - open: `closesAt` is the next time it stops, either the lunch break
 *   (`forBreak`) or the end of the day.
 * - closed: `opensAt` is the next time it starts, either the end of the
 *   break today (`onBreak`) or the first span of the next business day.
 */
export type CounterStatus =
  | { open: true; closesAt: ClockTime; forBreak: boolean }
  | {
      open: false;
      opensAt: ClockTime & { day: IsoDate };
      onBreak: boolean;
    };

export function counterStatus(
  tenant: Tenant,
  now: Date,
  timeZone: string = OFFICE_TIME_ZONE,
): CounterStatus {
  const today = toIsoDate(now, timeZone);
  const minutes = minutesInZone(now, timeZone);
  const spans = counterIntervals(tenant.counterHours);

  if (isBusinessDay(today)) {
    const current = spans.findIndex(([s, e]) => minutes >= s && minutes < e);
    if (current >= 0) {
      return {
        open: true,
        closesAt: toClock(spans[current][1]),
        forBreak: current < spans.length - 1,
      };
    }
    const later = spans.findIndex(([s]) => minutes < s);
    if (later >= 0) {
      return {
        open: false,
        opensAt: { day: today, ...toClock(spans[later][0]) },
        onBreak: later > 0,
      };
    }
  }

  const [nextDay] = nextBusinessDays(addDays(today, 1), 1);
  return {
    open: false,
    opensAt: { day: nextDay, ...toClock(spans[0][0]) },
    onBreak: false,
  };
}

/**
 * The one sentence the public site uses for the counter's state: the home
 * card and the contact page say the same thing, worded here only.
 */
export function counterStatusLabel(
  status: CounterStatus,
  now: Date,
  timeZone: string = OFFICE_TIME_ZONE,
): string {
  if (status.open) {
    return status.forBreak
      ? `Aberto agora · intervalo às ${formatClock(status.closesAt)}`
      : `Aberto agora · fecha às ${formatClock(status.closesAt)}`;
  }
  if (status.onBreak) {
    return `Em intervalo · volta às ${formatClock(status.opensAt)}`;
  }
  const day =
    status.opensAt.day === toIsoDate(now, timeZone)
      ? "hoje"
      : longWeekday(status.opensAt.day);
  return `Fechado agora · abre ${day} às ${formatClock(status.opensAt)}`;
}

/**
 * How the office says it is answering the chat right now. Three states and
 * not a boolean because the office asked for two different things from one
 * switch: "estou aqui agora, abre" and "abre sozinho no meu horário". A
 * boolean can only carry one of them, and the one it carried was the
 * schedule, which is why turning the switch on outside business hours left
 * the citizen looking at "fora do horário".
 *
 * - `on`: the office says it is answering. Open, whatever the clock says.
 * - `auto`: open inside `counterHours` on a business day, closed outside.
 * - `off`: no chat at all, the button does not appear.
 */
export const CHAT_AVAILABILITIES = ["on", "auto", "off"] as const;
export type ChatAvailability = (typeof CHAT_AVAILABILITIES)[number];

export function isChatAvailability(value: string): value is ChatAvailability {
  return (CHAT_AVAILABILITIES as readonly string[]).includes(value);
}

/** Whether the floating button appears at all. */
export function isChatVisible(availability: ChatAvailability): boolean {
  return availability !== "off";
}

/**
 * Whether the chat takes a message right now. The one place the rule lives:
 * the widget, the status endpoint and the route that opens a conversation
 * all read this, or a chat forced open would offer a form the server then
 * refuses.
 */
export function isChatOpen(
  availability: ChatAvailability,
  tenant: Tenant,
  now: Date,
  timeZone: string = OFFICE_TIME_ZONE,
): boolean {
  if (availability === "off") return false;
  if (availability === "on") return true;
  return isWithinChatHours(tenant, now, timeZone);
}

/**
 * How the switch reads on the panel, in the operator's words. Kept next to
 * the states themselves, the way `SECTION_LABELS` sits next to the sections:
 * the header pill and the switch have to say the same thing.
 */
export const CHAT_AVAILABILITY_LABELS: Record<ChatAvailability, string> = {
  on: "Disponível para o chat",
  auto: "Segue o horário de atendimento",
  off: "Indisponível para o chat",
};

/**
 * When the chat opens next: later today (before the opening, or during the
 * lunch break), or the next business day otherwise: for the "Voltamos
 * segunda-feira às 8h" line the closed widget shows. Asked while open, it
 * answers the same as at closing time: the next business day's opening.
 */
export function nextChatOpening(
  tenant: Tenant,
  now: Date,
  timeZone: string = OFFICE_TIME_ZONE,
): ClockTime & { day: IsoDate } {
  const status = counterStatus(tenant, now, timeZone);
  if (!status.open) return status.opensAt;
  const today = toIsoDate(now, timeZone);
  const [nextDay] = nextBusinessDays(addDays(today, 1), 1);
  return { day: nextDay, ...toClock(tenant.counterHours.startHour * 60) };
}
