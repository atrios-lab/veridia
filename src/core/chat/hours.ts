import {
  addDays,
  type IsoDate,
  isBusinessDay,
  nextBusinessDays,
  toIsoDate,
} from "../scheduling/calendar.ts";
import type { Tenant } from "../tenant/schema.ts";

// Every office served today is in Brazil; a per-tenant time zone is not a
// field the platform has, so this mirrors the single constant in
// src/lib/tenant.ts rather than importing it: that module is "server-only"
// and reaches the database, which src/core must never depend on.
const DEFAULT_TIME_ZONE = "America/Sao_Paulo";

function hourInZone(instant: Date, timeZone: string): number {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      hour: "2-digit",
    }).format(instant),
  );
}

/**
 * Whether the chat is inside the office's attendance window right now: a
 * business day (see `isBusinessDay`, weekday and not a national holiday) and
 * the wall-clock hour falls in `tenant.counterHours`, the hours the counter
 * itself keeps. Chat hours are not a separate setting, see support-chat
 * spec, "Horário do chat segue o horário de atendimento configurado". Note
 * this is the counter's window, not the appointment grid: an office open
 * every day may receive by appointment on Tuesdays only.
 */
export function isWithinChatHours(
  tenant: Tenant,
  now: Date,
  timeZone: string = DEFAULT_TIME_ZONE,
): boolean {
  const day = toIsoDate(now, timeZone);
  if (!isBusinessDay(day)) return false;
  const hour = hourInZone(now, timeZone);
  return (
    hour >= tenant.counterHours.startHour && hour < tenant.counterHours.endHour
  );
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
  timeZone: string = DEFAULT_TIME_ZONE,
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
 * When the chat opens next: today, if attendance has not started yet, or
 * the next business day otherwise: for the "Voltamos segunda-feira às 8h"
 * line the closed widget shows.
 */
export function nextChatOpening(
  tenant: Tenant,
  now: Date,
  timeZone: string = DEFAULT_TIME_ZONE,
): { day: IsoDate; hour: number } {
  const today = toIsoDate(now, timeZone);
  const hour = hourInZone(now, timeZone);
  if (isBusinessDay(today) && hour < tenant.counterHours.startHour) {
    return { day: today, hour: tenant.counterHours.startHour };
  }
  const [nextDay] = nextBusinessDays(addDays(today, 1), 1);
  return { day: nextDay, hour: tenant.counterHours.startHour };
}
