import { z } from "zod";
import { SOUND_IDS, type SoundChoice } from "../chat/alerts.ts";

/**
 * How the office wants the panel to call it, channel by channel (product
 * decision of 09/11/2026): for each part of the site that brings news (the
 * chat, the agenda, the guias, the requests, LGPD, ouvidoria, the internal
 * messenger and the audit), whether to
 * call at all, with a card on screen, the browser's notification, which
 * tone, and whether the screen shakes. The office's choice, for every
 * attendant: kept in `tenant_content`, edited in Configurações. The chat
 * keeps, on top, each computer's own volume and repeat (Atendimento online).
 */
export const ALERT_CHANNELS = [
  "chat",
  "agenda",
  "guias",
  "pedidos",
  "lgpd",
  "ouvidoria",
  // Added 11/11/2026: the internal messenger and the audit's notices.
  "mensagens",
  "auditoria",
] as const;
export type AlertChannel = (typeof ALERT_CHANNELS)[number];

export const ALERT_CHANNEL_LABELS: Record<AlertChannel, string> = {
  chat: "Atendimento online (chat)",
  agenda: "Agendamentos",
  guias: "Guias de transmissão de bens",
  pedidos: "Pedidos de serviço",
  lgpd: "Requerimentos LGPD",
  ouvidoria: "Ouvidoria",
  mensagens: "Mensagens internas",
  auditoria: "Auditoria (notificações e atos urgentes)",
};

const soundChoice = z.custom<SoundChoice>(
  (value) =>
    value === "none" ||
    (typeof value === "string" &&
      (SOUND_IDS as readonly string[]).includes(value)),
);

export const ChannelAlertSchema = z.object({
  /** false is "Silenciar": nothing at all for this channel. */
  enabled: z.boolean(),
  /** The card on the panel's screen. */
  popup: z.boolean(),
  /** The browser's own notification (needs the browser's permission). */
  notify: z.boolean(),
  sound: soundChoice,
  /** The panel shakes and the phone vibrates. */
  shake: z.boolean(),
});
export type ChannelAlert = z.infer<typeof ChannelAlertSchema>;

const DEFAULTS: Record<AlertChannel, ChannelAlert> = {
  chat: {
    enabled: true,
    popup: true,
    notify: true,
    sound: "sino",
    shake: true,
  },
  agenda: {
    enabled: true,
    popup: true,
    notify: true,
    sound: "campainha",
    shake: false,
  },
  guias: {
    enabled: true,
    popup: true,
    notify: true,
    sound: "toque-duplo",
    shake: false,
  },
  pedidos: {
    enabled: true,
    popup: true,
    notify: true,
    sound: "suave",
    shake: false,
  },
  lgpd: {
    enabled: true,
    popup: true,
    notify: true,
    sound: "suave",
    shake: false,
  },
  ouvidoria: {
    enabled: true,
    popup: true,
    notify: true,
    sound: "suave",
    shake: false,
  },
  // Rings again and again until the person answers (decision of 11/11/2026).
  mensagens: {
    enabled: true,
    popup: true,
    notify: true,
    sound: "mensageiro",
    shake: true,
  },
  auditoria: {
    enabled: true,
    popup: true,
    notify: true,
    sound: "alerta",
    shake: false,
  },
};

export type OfficeAlerts = Record<AlertChannel, ChannelAlert>;

/** The defaults, with any sound id the catalog no longer has replaced. */
export function defaultOfficeAlerts(): OfficeAlerts {
  const valid = (sound: SoundChoice) =>
    sound === "none" || (SOUND_IDS as readonly string[]).includes(sound)
      ? sound
      : "sino";
  return Object.fromEntries(
    ALERT_CHANNELS.map((channel) => [
      channel,
      { ...DEFAULTS[channel], sound: valid(DEFAULTS[channel].sound) },
    ]),
  ) as OfficeAlerts;
}

export const OfficeAlertsSchema = z.object(
  Object.fromEntries(
    ALERT_CHANNELS.map((c) => [c, ChannelAlertSchema]),
  ) as Record<AlertChannel, typeof ChannelAlertSchema>,
);

/**
 * What is stored, read leniently: a channel missing or malformed (a row
 * saved before the channel existed) falls back to its default alone.
 */
export function parseOfficeAlerts(raw: unknown): OfficeAlerts {
  const defaults = defaultOfficeAlerts();
  const source =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return Object.fromEntries(
    ALERT_CHANNELS.map((channel) => {
      const parsed = ChannelAlertSchema.safeParse(source[channel]);
      return [channel, parsed.success ? parsed.data : defaults[channel]];
    }),
  ) as OfficeAlerts;
}
