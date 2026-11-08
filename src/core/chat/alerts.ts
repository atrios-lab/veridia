/**
 * The attendant's alerts: what changed between two looks at the chat, how
 * each change is said, and the attendant's own choices (sound, volume,
 * repeat, browser notifications, on-screen flash).
 *
 * Pure: the panel's watcher (app/admin/_components/chat-alerts.tsx) polls
 * the server for a snapshot, hands the previous and the new one here, and
 * plays, notifies and flashes whatever comes back. Nothing here touches a
 * browser API, so the rules are testable as plain data.
 */
import { z } from "zod";

/** One conversation waiting in the queue, as the alert names it. */
export type WaitingItem = { id: string; citizenName: string; subject: string };

/** One conversation the attendant is attending, with the citizen's latest
 * message time (ISO), or null before the citizen has written. */
export type MineItem = {
  id: string;
  citizenName: string;
  lastCitizenMessageAt: string | null;
};

/** What the watcher sees on each poll. `status` is the attendant's own
 * (available, busy, away). */
export type AlertSnapshot = {
  status: string;
  waiting: WaitingItem[];
  mine: MineItem[];
};

export type ChatAlert = {
  kind: "new-waiting" | "assigned" | "new-message";
  conversationId: string;
  title: string;
  body: string;
  href: string;
};

const QUEUE_HREF = "/admin/atendimento";
const conversationHref = (id: string) => `/admin/atendimento/${id}`;

/**
 * Whether someone waiting should keep calling this attendant. "Ausente"
 * means away from the desk: the queue does not ring for them, though their
 * own conversations still do.
 */
export function listensToQueue(status: string): boolean {
  return status !== "away";
}

/**
 * The alerts between two snapshots. The first snapshot after the panel opens
 * (`previous` undefined) raises none: what was already there is shown by the
 * on-screen reminder, not announced as news.
 *
 * - new-waiting: a conversation in the queue that was not there before.
 * - assigned: a conversation now mine that was neither mine nor waiting
 *   before, which is a colleague transferring it. One taken from the queue
 *   with "Atender" was waiting before, and the attendant who clicked does
 *   not need to be told.
 * - new-message: the citizen wrote again in a conversation that was already
 *   mine.
 */
export function diffAlerts(
  previous: AlertSnapshot | undefined,
  next: AlertSnapshot,
): ChatAlert[] {
  if (!previous) return [];
  const alerts: ChatAlert[] = [];

  if (listensToQueue(next.status)) {
    const before = new Set(previous.waiting.map((c) => c.id));
    for (const c of next.waiting) {
      if (before.has(c.id)) continue;
      alerts.push({
        kind: "new-waiting",
        conversationId: c.id,
        title: "Nova conversa na fila",
        body: `${c.citizenName} · ${c.subject}`,
        href: QUEUE_HREF,
      });
    }
  }

  const wasMine = new Map(previous.mine.map((c) => [c.id, c]));
  const wasWaiting = new Set(previous.waiting.map((c) => c.id));
  for (const c of next.mine) {
    const old = wasMine.get(c.id);
    if (!old) {
      if (wasWaiting.has(c.id)) continue;
      alerts.push({
        kind: "assigned",
        conversationId: c.id,
        title: "Conversa transferida para você",
        body: c.citizenName,
        href: conversationHref(c.id),
      });
      continue;
    }
    if (
      c.lastCitizenMessageAt &&
      (!old.lastCitizenMessageAt ||
        c.lastCitizenMessageAt > old.lastCitizenMessageAt)
    ) {
      alerts.push({
        kind: "new-message",
        conversationId: c.id,
        title: "Nova mensagem",
        body: c.citizenName,
        href: conversationHref(c.id),
      });
    }
  }

  return alerts;
}

/** Whether the "repetir até atender" ring is due: someone is waiting and
 * this attendant listens to the queue. */
export function queueNeedsAttention(snapshot: AlertSnapshot): boolean {
  return snapshot.waiting.length > 0 && listensToQueue(snapshot.status);
}

/** How the on-screen reminder reads the queue. */
export function waitingLabel(count: number): string {
  return count === 1
    ? "1 pessoa aguardando atendimento"
    : `${count} pessoas aguardando atendimento`;
}

/**
 * The tones on offer, each a short score of notes the browser synthesises
 * (Web Audio): no audio file to fetch, cache or allow in the CSP. `start`
 * and `duration` are seconds from the moment it plays; `wave` is the
 * oscillator's shape.
 */
export type Note = {
  frequency: number;
  start: number;
  duration: number;
  wave: "sine" | "triangle" | "square";
};

export const SOUNDS = {
  sino: {
    label: "Sino",
    notes: [
      { frequency: 1046.5, start: 0, duration: 0.9, wave: "sine" },
      { frequency: 1568, start: 0, duration: 0.6, wave: "sine" },
    ],
  },
  campainha: {
    label: "Campainha",
    notes: [
      { frequency: 880, start: 0, duration: 0.18, wave: "triangle" },
      { frequency: 1174.7, start: 0.2, duration: 0.3, wave: "triangle" },
    ],
  },
  "toque-duplo": {
    label: "Toque duplo",
    notes: [
      { frequency: 987.8, start: 0, duration: 0.14, wave: "sine" },
      { frequency: 987.8, start: 0.22, duration: 0.14, wave: "sine" },
    ],
  },
  alerta: {
    label: "Alerta",
    notes: [
      { frequency: 1318.5, start: 0, duration: 0.12, wave: "square" },
      { frequency: 1046.5, start: 0.15, duration: 0.12, wave: "square" },
      { frequency: 1318.5, start: 0.3, duration: 0.12, wave: "square" },
    ],
  },
  suave: {
    label: "Suave",
    notes: [
      { frequency: 659.3, start: 0, duration: 0.35, wave: "sine" },
      { frequency: 784, start: 0.3, duration: 0.5, wave: "sine" },
    ],
  },
} as const satisfies Record<string, { label: string; notes: readonly Note[] }>;

export type SoundId = keyof typeof SOUNDS;
export const SOUND_IDS = Object.keys(SOUNDS) as SoundId[];

/** How often "repetir até atender" rings, in seconds. */
export const REPEAT_OPTIONS = [15, 30, 60] as const;

/**
 * The attendant's choices, kept in this browser (each computer at the
 * counter has its own speakers and its own volume). Every field defaults,
 * so a saved value from an older version, or garbage, reads as the
 * defaults rather than failing.
 */
const SOUND_CHOICES = [
  "sino",
  "campainha",
  "toque-duplo",
  "alerta",
  "suave",
  "none",
] as const;

export const AlertPrefsSchema = z.object({
  // "none" is "Sem som": the flash and the notification still work.
  sound: z.enum(SOUND_CHOICES).catch("sino"),
  volume: z
    .number()
    .transform((v) => Math.round(Math.min(100, Math.max(0, v))))
    .catch(80),
  repeat: z.boolean().catch(true),
  repeatSeconds: z
    .number()
    .refine((s) => (REPEAT_OPTIONS as readonly number[]).includes(s))
    .catch(30),
  notify: z.boolean().catch(true),
  flash: z.boolean().catch(true),
});
export type AlertPrefs = z.infer<typeof AlertPrefsSchema>;

export const DEFAULT_ALERT_PREFS: AlertPrefs = AlertPrefsSchema.parse({});

/** Reads saved preferences, whatever shape they were saved in. */
export function parseAlertPrefs(raw: unknown): AlertPrefs {
  const object = typeof raw === "object" && raw !== null ? raw : {};
  return AlertPrefsSchema.parse(object);
}

/** The gain a volume (0 to 100) plays at. Squared, because hearing is
 * logarithmic: a straight line puts nearly all of the change in the first
 * third of the slider. */
export function volumeGain(volume: number): number {
  const v = Math.min(100, Math.max(0, volume)) / 100;
  return v * v;
}
