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
 * A service the office created itself, beyond the catalogue in
 * `services.ts`. The id is what the record keeps a pointer to; the label is
 * what everyone reads, and it is copied onto the appointment at booking time
 * so a rename never rewrites history.
 */
export const agendaServiceSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1, "Dê um nome ao serviço."),
  // From before the two agendas: a service "só com o tabelião" was flagged
  // here. Kept so old configs parse; the agenda a service is ticked in is
  // what says it now.
  notaryOnly: z.boolean().default(false),
  // What the citizen brings for it, one item per entry, shown with the
  // catalogue's base list. Empty for services saved before the field.
  bring: z.array(z.string().min(1)).default([]),
});
export type AgendaService = z.infer<typeof agendaServiceSchema>;

export const closedDateSchema = z.object({
  date: isoDate,
  reason: z.string().min(1, "Informe o motivo do fechamento."),
});
export type ClosedDate = z.infer<typeof closedDateSchema>;

/**
 * The two agendas of a serventia: the counter's, for everything the clerks
 * attend, and the notary's own, for the acts the tabelião signs in person.
 * Fixed, not a list the office grows: what changes from one office to the
 * next is which days each one receives and which services each one takes.
 */
export const AGENDA_IDS = ["geral", "tabeliao"] as const;
export type AgendaId = (typeof AGENDA_IDS)[number];

export const AGENDA_NAMES: Record<
  AgendaId,
  { name: string; short: string; description: string }
> = {
  geral: {
    name: "Atendimento do cartório",
    short: "Cartório",
    description:
      "Registro civil, certidões, firma, autenticação, imóveis, protesto e os demais serviços do balcão.",
  },
  tabeliao: {
    name: "Atendimento com o tabelião",
    short: "Tabelião",
    description:
      "Escrituras, procurações, testamentos, inventários e divórcios, atendidos pelo tabelião da serventia.",
  },
};

export function isAgendaId(value: unknown): value is AgendaId {
  return (AGENDA_IDS as readonly unknown[]).includes(value);
}

/** The agenda an appointment row names, defaulting to the counter's: every
 * appointment from before the split was the counter's. */
export function agendaIdOf(value: unknown): AgendaId {
  return isAgendaId(value) ? value : "geral";
}

const gridSchema = z.partialRecord(weekdayKey, dayTimes).default({});
export type AgendaGrid = z.infer<typeof gridSchema>;

/** One agenda: the weekdays and times it receives, and the services it
 * takes, as ids from the catalogue or from the office's own services. */
export const agendaBookSchema = z.object({
  grid: gridSchema,
  serviceIds: z.array(z.string().min(1)).default([]),
});
export type AgendaBook = z.infer<typeof agendaBookSchema>;

const storedConfigSchema = z.object({
  agendas: z
    .object({
      geral: agendaBookSchema.optional(),
      tabeliao: agendaBookSchema.optional(),
    })
    .optional(),
  // Before the two agendas, the single grid lived here. Read as the
  // counter's agenda when `agendas` is absent, and still written next to it
  // (`serializeAgendaConfig`) so a deploy rolled back reads the same hours.
  grid: gridSchema,
  services: z.array(agendaServiceSchema).default([]),
  modes: z.array(z.string().min(1)).default([]),
  closedDates: z.array(closedDateSchema).default([]),
});

export interface AgendaConfig {
  agendas: Record<AgendaId, AgendaBook>;
  /** The office's own services; the catalogue ones are not stored. */
  services: AgendaService[];
  modes: string[];
  /** Single dates the office closed: they close both agendas. */
  closedDates: ClosedDate[];
}

/**
 * The stored shape, normalised. A config saved before the split becomes the
 * counter's agenda with the same grid and the same services, and an empty
 * notary agenda, so nothing changes on the site until the office sets the
 * second one up.
 */
export const agendaConfigSchema = storedConfigSchema.transform(
  (stored): AgendaConfig => ({
    agendas: {
      geral: stored.agendas?.geral ?? {
        grid: stored.grid,
        serviceIds: stored.services.map((service) => service.id),
      },
      tabeliao: stored.agendas?.tabeliao ?? { grid: {}, serviceIds: [] },
    },
    services: stored.services,
    modes: stored.modes,
    closedDates: stored.closedDates,
  }),
);

/** What goes into the row: the config plus the legacy grid, see above. */
export function serializeAgendaConfig(config: AgendaConfig) {
  return { ...config, grid: config.agendas.geral.grid };
}

/**
 * What an office starts with before anyone configures it: no grid, so the
 * public page says "agende pelo telefone" instead of inventing hours nobody
 * promised. The two modes every serventia has are seeded because they are the
 * floor, not a guess (an office that only receives at the counter deletes
 * one.
 */
export const DEFAULT_AGENDA_CONFIG: AgendaConfig = {
  agendas: {
    geral: { grid: {}, serviceIds: [] },
    tabeliao: { grid: {}, serviceIds: [] },
  },
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
 * What the slot rules read for one agenda: its own weekly grid and the
 * office's closed dates, which close both agendas.
 */
export interface AgendaRules {
  grid: AgendaGrid;
  closedDates: ClosedDate[];
}

export function agendaRules(config: AgendaConfig, id: AgendaId): AgendaRules {
  return { grid: config.agendas[id].grid, closedDates: config.closedDates };
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

/** "08:30" plus (or minus) minutes, as "HH:mm". */
export function addMinutes(time: SlotTime, minutes: number): SlotTime {
  const [hour, minute] = time.split(":").map(Number);
  // Wrapped into the day both ways, so "15 minutes before 00:05" is a
  // clock time and not a negative one.
  const total = (((hour * 60 + minute + minutes) % 1440) + 1440) % 1440;
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

/** The end of the appointment that starts here. */
export function slotEndTime(time: SlotTime): SlotTime {
  return addMinutes(time, SLOT_DURATION_MINUTES);
}

/** Whether the office declared this single date closed, and why. */
export function closedDate(
  rules: Pick<AgendaRules, "closedDates">,
  date: IsoDate,
): ClosedDate | undefined {
  return rules.closedDates.find((closed) => closed.date === date);
}

/**
 * The times declared for a weekday, by its `weekday()` number. Days outside
 * Monday to Friday simply have none, which is what the calendar already says.
 */
export function timesForWeekday(
  rules: Pick<AgendaRules, "grid">,
  day: number,
): SlotTime[] {
  const key = String(day) as `${AgendaWeekday}`;
  return rules.grid[key] ?? [];
}

/** Whether any weekday carries a time at all. An office that configured
 * nothing must be told apart from one whose days are merely full. */
export function hasGrid(rules: Pick<AgendaRules, "grid">): boolean {
  return AGENDA_WEEKDAYS.some((day) => timesForWeekday(rules, day).length > 0);
}

/**
 * The id of a service the office creates, derived from its label so the
 * citizen's choice survives a reorder of the list. A rename still produces a
 * new id, which is exactly why the appointment keeps its own copy of the
 * label. Never a dot: that is how the catalogue's ids are told apart.
 *
 * Two labels that reduce to the same slug ("Certidão" and "Certidao") get a
 * suffix: an id shared by two services would hand the second one's citizens
 * the first one's name.
 */
export function ownServiceId(label: string, used: ReadonlySet<string>): string {
  const base =
    label
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "servico";
  let id = base;
  for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
  return id;
}

/** An own service's id as the form may send it: slug characters only. */
export const OWN_SERVICE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
