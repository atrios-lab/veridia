import { z } from "zod";
import { deadlineDaysSchema } from "../request/deadline.ts";
import { LAW_HOLIDAY_IDS } from "../scheduling/calendar.ts";
import { SUPPORTED_STATES } from "../transparency/rubrics.ts";
import {
  isValidPixCity,
  isValidPixKey,
  PIX_CITY_MAX_LENGTH,
  PixKeyTypeSchema,
} from "./pix.ts";

// The six legal attributions of a Brazilian extrajudicial notary office.
// Official acronyms, never translated: they are the legal identifiers.
export const ATTRIBUTIONS = [
  "RCPN",
  "NOTAS",
  "RI",
  "PROTESTO",
  "RTD",
  "RCPJ",
] as const;
export const AttributionSchema = z.enum(ATTRIBUTIONS);
export type Attribution = z.infer<typeof AttributionSchema>;

/**
 * Who answers for each attribution (decision of 14/11/2026): the delegated
 * holder (titular by concurso), an interim (interino) or a court-appointed
 * intervenor (interventor). The office marks it, attribution by attribution.
 */
export const ATTRIBUTION_REGIMES = [
  "delegado",
  "interino",
  "interventor",
] as const;
export const AttributionRegimeSchema = z.enum(ATTRIBUTION_REGIMES);
export type AttributionRegime = z.infer<typeof AttributionRegimeSchema>;
export const ATTRIBUTION_REGIME_LABELS: Record<AttributionRegime, string> = {
  delegado: "Delegado (titular)",
  interino: "Interino",
  interventor: "Interventor",
};

// Sections of the public site. The values are route slugs, so they stay in
// Portuguese: they are user visible URLs, not identifiers.
export const SECTIONS = [
  "inicio",
  "dpo-lgpd",
  "pedidos",
  "agendamento",
  "consulta-protocolo",
  "ouvidoria",
  "transparencia",
  "editais",
  "selo-tjrn",
  "centrais-contato",
] as const;
export const SectionSchema = z.enum(SECTIONS);
export type Section = z.infer<typeof SectionSchema>;

// The visual themes an office may pick. Structure and journey are identical
// across them: a theme only swaps the palette and the serif face, and both
// live in the stylesheet. Registering an office is picking one of these, never
// writing CSS. The values are theme identifiers, kept in Portuguese because
// they name colours the registrar recognises.
export const THEMES = [
  "verde-dourado",
  "marinho-bronze",
  "vinho-perola",
  "grafite-cobre",
  "oliva-terracota",
] as const;
export const ThemeSchema = z.enum(THEMES, "Escolha o estilo do site.");
export type Theme = z.infer<typeof ThemeSchema>;

export const OwnerStatusSchema = z.enum(["provido", "interino", "a confirmar"]);

/**
 * When the counter is open, in numbers. Declared apart from `TenantSchema` so
 * the panel can reuse the rule without the default: an override that carries
 * no hours has to leave the office's own alone, and a default reached through
 * `.partial()` would quietly write 8h-14h over them instead.
 */
const CLOCK_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Minutes since midnight of an "HH:MM" already checked by CLOCK_PATTERN. */
export function clockToMinutes(clock: string): number {
  const [hour, minute] = clock.split(":").map(Number);
  return hour * 60 + minute;
}

/**
 * The pause in the middle of the day (lunch, in every office that has one).
 * "HH:MM" and not whole hours like the opening and closing, because the one
 * real case that is not on the hour is a return at 13h30. Only the break
 * takes minutes: no office opens or closes on the half hour.
 */
export const LunchBreakSchema = z
  .object({
    start: z.string().regex(CLOCK_PATTERN, "Use o formato 12:00."),
    end: z.string().regex(CLOCK_PATTERN, "Use o formato 13:30."),
  })
  .refine((b) => clockToMinutes(b.end) > clockToMinutes(b.start), {
    message: "O fim do intervalo tem de ser depois do início.",
  });
export type LunchBreak = z.infer<typeof LunchBreakSchema>;

/**
 * Whether a break leaves a morning and an afternoon inside the hours. Strict
 * on both ends: a break that starts at the opening is a later opening, not a
 * break, and saying so is clearer than computing an empty morning.
 */
export function breakFitsHours(
  lunchBreak: LunchBreak,
  hours: { startHour: number; endHour: number },
): boolean {
  return (
    clockToMinutes(lunchBreak.start) > hours.startHour * 60 &&
    clockToMinutes(lunchBreak.end) < hours.endHour * 60
  );
}

export const CounterHoursSchema = z
  .object({
    startHour: z.number().int().min(0).max(23),
    endHour: z.number().int().min(1).max(24),
    // Optional and nullable on purpose, and the two mean different things
    // when an override is read (see applyTenantOverrides): absent is a row
    // saved before breaks existed, null is "no break", said on purpose.
    lunchBreak: LunchBreakSchema.nullable().optional(),
  })
  .refine((s) => s.endHour > s.startHour, {
    message: "A hora de encerramento tem de ser depois da de abertura.",
  })
  .refine((s) => !s.lunchBreak || breakFitsHours(s.lunchBreak, s), {
    message: "O intervalo tem de ficar dentro do horário de atendimento.",
    path: ["lunchBreak"],
  });
export type CounterHours = z.infer<typeof CounterHoursSchema>;

/** A real calendar day, "YYYY-MM-DD": 2026-02-30 is refused. */
function isRealDate(value: string): boolean {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * A day off the office declares in the panel (see `CustomHoliday` in
 * core/scheduling/calendar.ts): a name the status line shows, the date, and
 * whether it repeats every year on that day and month.
 */
export const CustomHolidaySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Dê um nome ao feriado.")
    .max(80, "Use no máximo 80 caracteres."),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data.")
    .refine(isRealDate, "Informe uma data que exista."),
  yearly: z.boolean(),
  // The law that creates the holiday, when there is one ("Lei municipal nº
  // 1.234/2010"): how an office records a day a new law creates, or puts
  // back one it excluded by mistake, with its basis on file.
  legalBasis: z
    .string()
    .trim()
    .min(1, "Informe a lei que cria o feriado.")
    .max(120, "Use no máximo 120 caracteres.")
    .optional(),
});

/** Room for every municipal and local day an office could plausibly keep. */
export const MAX_CUSTOM_HOLIDAYS = 60;

/**
 * Where the serventia sits in the court's map: "Comarca de Macaíba", or the
 * termo of a comarca whose seat is elsewhere, or both at once, written as
 * the office writes it on its papers ("Comarca/Termo de Macaíba/RN"). The
 * seat is the comarca's city, which is not always the office's own. "none"
 * is the office's choice to print no such line: then there is no seat.
 */
export const JURISDICTION_KINDS = [
  "comarca",
  "termo",
  "comarca-termo",
  "none",
] as const;
/** Every Brazilian UF, for the comarca line: not `SUPPORTED_STATES`, which
 * only lists the states whose fund maps exist. */
export const BRAZILIAN_UFS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

export const JurisdictionSchema = z
  .object({
    kind: z.enum(JURISDICTION_KINDS),
    seat: z.string().trim().max(60, "Use até 60 caracteres.").optional(),
    // The comarca's UF as the office prints it; the office's own state
    // (`location.state`) until it says otherwise.
    uf: z.enum(BRAZILIAN_UFS).optional(),
  })
  .refine((value) => value.kind === "none" || Boolean(value.seat), {
    message: "Informe a cidade sede da comarca.",
    path: ["seat"],
  });
export type Jurisdiction = z.infer<typeof JurisdictionSchema>;

export const TenantSchema = z.object({
  slug: z.string().min(1),
  hosts: z.array(z.string()).default([]),
  name: z.string().min(1),
  subtitle: z.string().min(1),
  // The "Quem somos" paragraph on the home page. Per office: it describes
  // the serventia itself, so there is no sensible shared default.
  about: z.string().min(1, "Escreva o texto de apresentação do cartório."),
  cns: z.string().min(1),
  attributions: z.array(AttributionSchema).nonempty(),
  // Who answers for each attribution, by sigla ("RCPN", "NOTAS"... and
  // "DISTRIBUICAO"). Absent: the office has not said; read as delegated.
  attributionRegimes: z.record(z.string(), AttributionRegimeSchema).optional(),
  // The Registro de Distribuição (Lei nº 8.935/1994, art. 13), apart from
  // the six because no act of the site's catalog belongs to it: it only
  // decides whether its guide shows in the panel.
  offersDistribution: z.boolean().optional(),
  // Sender address for this office's transactional email (the "From").
  // The address's domain must be verified in Postmark (DKIM + Return-Path);
  // absent, delivery falls back to the platform-wide sender (see
  // src/lib/email/send.ts).
  emailFrom: z.email().optional(),
  contacts: z.object({
    phone: z.string().min(1, "Informe o telefone."),
    whatsapp: z.string().min(1, "Informe o WhatsApp."),
    email: z.email("Informe um e-mail válido."),
  }),
  openingHours: z.string().min(1, "Informe o horário de atendimento."),
  // The same counter hours as the sentence above, in numbers, because reading
  // a number out of Portuguese prose breaks on the first office that writes it
  // differently. The sentence stays: it is what the citizen reads.
  //
  // This is when the counter is open, which is what the chat's availability
  // and the "Aberto agora" line read. It is NOT the appointment grid: the days
  // and times the office receives by appointment are configured in the panel
  // (see src/core/scheduling/agenda.ts), and an office open every day may well
  // schedule on Tuesdays only.
  counterHours: CounterHoursSchema.default({ startHour: 8, endHour: 14 }),
  owner: z.object({
    name: z.string().min(1),
    status: OwnerStatusSchema,
  }),
  // Data protection officer. Required by LGPD art. 41 §3: this is an
  // institutional channel, never a personal address.
  dpo: z.object({
    name: z.string().min(1, "Informe o nome do encarregado."),
    email: z.email("Informe um e-mail válido."),
  }),
  // ISS rate as a decimal (5% = 0.05). Municipal parameter, per office.
  issRate: z.number().min(0).max(1),
  // The term for the acts no statute fixes one for: escritura, ata notarial,
  // abertura de firma. Acts the law does fix a term for are born with it, off
  // the catalogue (see `Act.legalDeadlineDays`), and never read this.
  //
  // Ten business days as a starting point, not a legal term: it is the office
  // saying how long it usually takes, and the office changes it from the
  // panel. The term a given request actually runs on is set on the request.
  requestDeadlineDays: deadlineDaysSchema.default(10),
  // The office's own days off (municipal holidays, local commemorations),
  // on top of the national and state ones the calendar already knows. Edited
  // in the panel; a config file may seed them too.
  customHolidays: z
    .array(CustomHolidaySchema)
    .max(MAX_CUSTOM_HOLIDAYS, "São no máximo 60 feriados próprios.")
    .default([]),
  // The law days off (national and the state's Código de Normas) this office
  // does not keep, by rule id: some only apply in some places, and an office
  // that keeps one on another date switches it off and adds its own above.
  disabledHolidays: z
    .array(
      z
        .string()
        .refine((id) => LAW_HOLIDAY_IDS.includes(id), "Feriado desconhecido."),
    )
    .default([]),
  // Law days the office excluded from its list altogether, on top of
  // switching them off: the panel no longer lists them. One excluded by
  // mistake, or brought back by a new law, is added as the office's own,
  // with its law in `legalBasis`. The calendar reads only
  // `disabledHolidays`, so an id here without its pair there closes nothing
  // either way; the panel always writes both.
  hiddenHolidays: z
    .array(
      z
        .string()
        .refine((id) => LAW_HOLIDAY_IDS.includes(id), "Feriado desconhecido."),
    )
    .default([]),
  theme: ThemeSchema,
  logos: z.object({
    light: z.string().min(1), // logo for light backgrounds
    dark: z.string().min(1), // logo for dark backgrounds
    // Sublogo, used as favicon, watermark, and the admin login panel. Same
    // light/dark split as the main logo above, for the same reason: the
    // admin panel's institutional side is a fixed dark background, never the
    // tenant's own theme.
    seal: z.object({
      light: z.string().min(1),
      dark: z.string().min(1),
    }),
  }),
  // Photograph behind the home hero. Optional: an office that has not sent
  // one yet gets the plain gradient, which is a worse hero but never a
  // broken one.
  heroImage: z.string().min(1).optional(),
  // The two lines of text on the home hero. `eyebrow` defaults because every
  // office reads the same one today; `title` has no default because it has
  // always varied per office (it used to just be `subtitle`), so each tenant
  // config states it explicitly.
  home: z.object({
    eyebrow: z
      .string()
      .min(1, "Informe a frase de destaque.")
      .default("Serviços notariais e de registro"),
    title: z.string().min(1, "Informe o título de boas-vindas."),
  }),
  legalFooter: z.string().min(1),
  // Override: turns sections off even when the attribution grants them.
  // It never turns a section on beyond the gate.
  disabledSections: z.array(SectionSchema).default([]),
  // A fictional office shown to people who are not its citizens: the public
  // site carries a "this office does not exist" banner on every page and a
  // warning next to every submit button, and the chat never shows (nobody
  // answers it). Config as code only, never a panel switch, and false unless
  // declared: a real office can never be marked by accident.
  demo: z.boolean().default(false),
  // The office's Pix key, where the citizen's payment lands. Optional: most
  // offices have not registered one yet, and "no key" is a permanent, valid
  // state, not a transition. The key is validated against its own type
  // below, and stored normalized (see `normalizePixKey`).
  pix: z
    .object({
      type: PixKeyTypeSchema,
      key: z.string().min(1, "Informe a chave."),
    })
    .superRefine((value, ctx) => {
      if (!isValidPixKey(value.type, value.key)) {
        ctx.addIssue({
          code: "custom",
          path: ["key"],
          message:
            "Isso não parece uma chave Pix válida para o tipo escolhido.",
        });
      }
    })
    .optional(),
  // Merchant City of the Pix EMV payload: a structural fact about the
  // office, set once alongside name/CNS, not a value the panel edits. Never
  // shown in the panel either, since nobody there needs to look it up day to
  // day, unlike name/CNS.
  municipality: z
    .string()
    .refine(
      isValidPixCity,
      `O município deve ter até ${PIX_CITY_MAX_LENGTH} caracteres (sem acento).`,
    ),
  // Where the office is, for reading: the city as its people write it, with
  // accents ("São José de Mipibu"), and the state. Not `municipality`, which
  // is the Pix payload's Merchant City: upper case, no accents, cut at 15
  // characters ("SAO J DE MIPIBU"), right for a bank and wrong for a page.
  // The state picks the fund map of the transparency bulletin, so it only
  // takes a state whose map exists: an office elsewhere fails here, before it
  // can publish a bulletin with no funds on it.
  location: z.object({
    city: z.string().min(1),
    state: z.enum(SUPPORTED_STATES),
  }),
  // Whether the monthly bulletin also shows gross revenue, expenses and the
  // balance. Only the public share (the funds) is required by Res. CNJ
  // 670/2025; the rest is the office's own money and publishing it is the
  // titular's choice, made in the panel. On by default: it is the quadro the
  // offices already publish on their own.
  publishBulletinPrivateFigures: z.boolean().default(true),
  /**
   * The office's gross semestral revenue, as the Átrios levantou it from the
   * Justiça Aberta's public API during prospecting. Feeds the Provimento
   * intake's Seção 1, where the office confirms or corrects it: it is a
   * starting point, never the answer, and the number that reaches the
   * documents is whatever the office leaves in the field.
   *
   * Optional because an office registered before the survey, or one whose
   * numbers were never looked up, simply gets the fields blank. `extractedOn`
   * is not decoration: the figure is redeclared every January and July, and
   * the panel shows the date so a stale number reads as dated rather than as
   * an assertion of ours.
   *
   * A semester with no declaration at the source is left out entirely, never
   * written as zero: zero is a number that would classify the office (Classe
   * 1, subclasse A, the longest term) out of a declaration nobody made.
   */
  revenue: z
    .object({
      semester: z.number().positive(),
      previousSemester: z.number().positive().optional(),
      source: z.literal("justica-aberta"),
      extractedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })
    .optional(),
  // Street address of the serventia, for the Contato page's map card and
  // "Como chegar" route. Optional: offices registered before this field
  // existed have no value to backfill, and there is no migration for it:
  // without it, the page just omits the address/map card instead of showing
  // a broken state.
  address: z.string().min(1).optional(),
  // How the serventia identifies itself on every paper and page it issues,
  // per the Código de Normas da CGJ/TJRN (Provimento 156/2016, art. 2º):
  // the denomination, the comarca or termo, and, in smaller type below,
  // the holder and the legal attributions. Optional: an office that has not
  // filled them prints its name without the comarca line, and the panel
  // asks for them. See core/tenant/identification.ts.
  officialName: z.string().trim().min(1).max(120).optional(),
  jurisdiction: JurisdictionSchema.optional(),
  holderTitle: z.string().trim().min(1).max(80).optional(),
  // The holder's name as the papers print it. Not `owner`, which is the
  // court's record the platform keeps: when the office changes hands, the
  // office types the new name here and the papers follow at once.
  holderName: z.string().trim().min(1).max(120).optional(),
  // The foot of the page, as the office writes it, one line each. Absent,
  // the address and contacts are printed from the contact settings.
  footerLines: z
    .array(
      z.string().trim().min(1).max(200, "Use até 200 caracteres por linha."),
    )
    .max(3, "Use até 3 linhas no rodapé.")
    .optional(),
  // Optional per § 1º ("podendo-se constar"), and off by default, as on the
  // office's own certidões: the holder's name, and the legal attributions,
  // under the identification only when the office ticks them.
  // What the office's own papers already said, to start the Utilitários'
  // guias from (see core/guides/settings.ts): the municipal law and rate of
  // the ITIV, the prefeitura's CNPJ, who signs. The office corrects them on
  // the Utilitários screen; these are never claimed to be verified.
  guideDefaults: z
    .object({
      prefeituraCnpj: z.string().optional(),
      itivLaw: z.string().optional(),
      itivRateBasisPoints: z.number().int().min(0).max(10_000).optional(),
      signers: z
        .array(
          z.object({ name: z.string(), title: z.string(), note: z.string() }),
        )
        .optional(),
    })
    .optional(),
  showHolder: z.boolean().default(false),
  showAttributions: z.boolean().default(false),
});

export type Tenant = z.infer<typeof TenantSchema>;

/** Validates a raw config and returns the typed object, or throws. */
export function parseTenant(raw: unknown): Tenant {
  return TenantSchema.parse(raw);
}
