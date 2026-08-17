import { z } from "zod";
import type { IsoDate } from "./calendar.ts";

/**
 * The office's agenda as the serventia itself declares it: which weekdays it
 * receives, at what times, for which services, and which single dates it has
 * closed.
 *
 * Config, not code: the times a counter opens are the office's to change on a
 * Tuesday afternoon, and "drive-thru" is one office's particularity, not a
 * platform concept. Nothing here is a business rule: the rules that read this
 * live in `slots.ts`.
 */

/** The start of one appointment on the office's wall clock, "HH:mm". */
export type SlotTime = string;

const slotTime = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Informe o horário como HH:mm.");

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data como AAAA-MM-DD.");

/**
 * Monday to Friday, keyed the way `weekday()` numbers them. Saturday and
 * Sunday have no key: the calendar refuses them before the grid is consulted,
 * so a time saved there would be a promise the page never shows.
 */
export const AGENDA_WEEKDAYS = [1, 2, 3, 4, 5] as const;
export type AgendaWeekday = (typeof AGENDA_WEEKDAYS)[number];

export const WEEKDAY_LABELS: Record<AgendaWeekday, string> = {
  1: "Segunda",
  2: "Terça",
  3: "Quarta",
  4: "Quinta",
  5: "Sexta",
};

/** Sorted and deduplicated: the panel's form is a text field, and two "09:00"
 * on the same day would render two chips for one appointment. */
const dayTimes = z
  .array(slotTime)
  .transform((times) => [...new Set(times)].sort());

const weekdayKey = z.enum(["1", "2", "3", "4", "5"]);

/**
 * A service the citizen can pick. The id is what the record keeps a pointer
 * to; the label is what everyone reads, and it is copied onto the appointment
 * at booking time so a rename never rewrites history.
 */
export const agendaServiceSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1, "Dê um nome ao serviço."),
});
export type AgendaService = z.infer<typeof agendaServiceSchema>;

export const closedDateSchema = z.object({
  date: isoDate,
  reason: z.string().min(1, "Informe o motivo do fechamento."),
});
export type ClosedDate = z.infer<typeof closedDateSchema>;

export const agendaConfigSchema = z.object({
  grid: z.partialRecord(weekdayKey, dayTimes).default({}),
  services: z.array(agendaServiceSchema).default([]),
  modes: z.array(z.string().min(1)).default([]),
  closedDates: z.array(closedDateSchema).default([]),
});

export type AgendaConfig = z.infer<typeof agendaConfigSchema>;

/**
 * What an office starts with before anyone configures it: no grid, so the
 * public page says "agende pelo telefone" instead of inventing hours nobody
 * promised. The two modes every serventia has are seeded because they are the
 * floor, not a guess (an office that only receives at the counter deletes
 * one.
 */
export const DEFAULT_AGENDA_CONFIG: AgendaConfig = {
  grid: {},
  services: [],
  modes: ["Presencial", "On-line"],
  closedDates: [],
};

/**
 * Parses what came out of the database. An office that never configured
 * anything gets the seed, so the panel's form opens pre-filled; an office
 * that saved something gets exactly what it saved, deletions included.
 *
 * A malformed row falls back rather than throwing: an office with no bookable
 * hours is a bad Tuesday, a 500 on `/agendar` is an outage.
 */
export function parseAgendaConfig(value: unknown): AgendaConfig {
  if (value === null || value === undefined) return DEFAULT_AGENDA_CONFIG;
  const parsed = agendaConfigSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_AGENDA_CONFIG;
}

/**
 * How long one appointment lasts, for the calendar file and the e-mail. One
 * fixed size for every service, which is what the office's own Calendly did.
 *
 * ponytail: single duration for all services; add `durationMinutes` to
 * `agendaServiceSchema` and read it here when the office needs 20 minutes for
 * an authentication and an hour for a birth record.
 */
export const SLOT_DURATION_MINUTES = 60;

/** "08:30" plus minutes, as "HH:mm". Wraps nothing: an appointment that would
 * end past midnight is not a thing a counter does. */
export function addMinutes(time: SlotTime, minutes: number): SlotTime {
  const [hour, minute] = time.split(":").map(Number);
  const total = hour * 60 + minute + minutes;
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}`;
}

/** The end of the appointment that starts here. */
export function slotEndTime(time: SlotTime): SlotTime {
  return addMinutes(time, SLOT_DURATION_MINUTES);
}

/** The label of a service by id, for a record that kept only the pointer. */
export function serviceLabel(
  config: AgendaConfig,
  serviceId: string,
): string | undefined {
  return config.services.find((service) => service.id === serviceId)?.label;
}

/** Whether the office declared this single date closed, and why. */
export function closedDate(
  config: AgendaConfig,
  date: IsoDate,
): ClosedDate | undefined {
  return config.closedDates.find((closed) => closed.date === date);
}

/**
 * The times declared for a weekday, by its `weekday()` number. Days outside
 * Monday to Friday simply have none, which is what the calendar already says.
 */
export function timesForWeekday(config: AgendaConfig, day: number): SlotTime[] {
  const key = String(day) as `${AgendaWeekday}`;
  return config.grid[key] ?? [];
}

/** Whether any weekday carries a time at all. An office that configured
 * nothing must be told apart from one whose days are merely full. */
export function hasGrid(config: AgendaConfig): boolean {
  return AGENDA_WEEKDAYS.some((day) => timesForWeekday(config, day).length > 0);
}
