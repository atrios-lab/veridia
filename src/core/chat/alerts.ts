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
 * oscillator's shape; `slideTo` bends the pitch to that frequency over the
 * note (a bubble, a pop, a siren).
 *
 * Every tone is original. The "estilo" ones evoke a family (8-bit games,
 * the messengers of the 2000s, a phone's three-note alert) without copying
 * any brand's actual sound, which belongs to its owner.
 */
export type Note = {
  frequency: number;
  start: number;
  duration: number;
  wave: "sine" | "triangle" | "square" | "sawtooth";
  slideTo?: number;
};

type Sound = { label: string; group: string; notes: readonly Note[] };

const CLASSIC = "Clássicos";
const RETRO = "Retrô";
const CHAT = "Chat e celular";
const URGENT = "Urgentes";

export const SOUNDS = {
  sino: {
    label: "Sino",
    group: CLASSIC,
    notes: [
      { frequency: 1046.5, start: 0, duration: 0.9, wave: "sine" },
      { frequency: 1568, start: 0, duration: 0.6, wave: "sine" },
      { frequency: 2093, start: 0, duration: 0.3, wave: "sine" },
    ],
  },
  campainha: {
    label: "Campainha",
    group: CLASSIC,
    notes: [
      { frequency: 880, start: 0, duration: 0.2, wave: "triangle" },
      { frequency: 1174.7, start: 0.22, duration: 0.35, wave: "triangle" },
    ],
  },
  "toque-duplo": {
    label: "Toque duplo",
    group: CLASSIC,
    notes: [
      { frequency: 987.8, start: 0, duration: 0.16, wave: "triangle" },
      { frequency: 987.8, start: 0.24, duration: 0.16, wave: "triangle" },
    ],
  },
  suave: {
    label: "Suave",
    group: CLASSIC,
    notes: [
      { frequency: 659.3, start: 0, duration: 0.35, wave: "sine" },
      { frequency: 784, start: 0.3, duration: 0.55, wave: "sine" },
    ],
  },
  "retro-8bits": {
    label: "Retrô 8 bits",
    group: RETRO,
    notes: [
      { frequency: 523.3, start: 0, duration: 0.08, wave: "square" },
      { frequency: 659.3, start: 0.08, duration: 0.08, wave: "square" },
      { frequency: 784, start: 0.16, duration: 0.08, wave: "square" },
      { frequency: 1046.5, start: 0.24, duration: 0.22, wave: "square" },
    ],
  },
  "retro-bonus": {
    label: "Retrô bônus",
    group: RETRO,
    notes: [
      { frequency: 880, start: 0, duration: 0.07, wave: "square" },
      { frequency: 1318.5, start: 0.07, duration: 0.32, wave: "square" },
    ],
  },
  "retro-fliperama": {
    label: "Retrô fliperama",
    group: RETRO,
    notes: [
      {
        frequency: 300,
        start: 0,
        duration: 0.25,
        wave: "square",
        slideTo: 1200,
      },
      { frequency: 1200, start: 0.27, duration: 0.12, wave: "square" },
    ],
  },
  mensageiro: {
    label: "Mensageiro, estilo anos 2000",
    group: CHAT,
    notes: [
      { frequency: 1046.5, start: 0, duration: 0.12, wave: "sine" },
      { frequency: 1318.5, start: 0.09, duration: 0.12, wave: "sine" },
      { frequency: 1568, start: 0.18, duration: 0.3, wave: "triangle" },
    ],
  },
  "celular-tres-notas": {
    label: "Celular, três notas",
    group: CHAT,
    notes: [
      { frequency: 1174.7, start: 0, duration: 0.13, wave: "triangle" },
      { frequency: 1567.98, start: 0.13, duration: 0.13, wave: "triangle" },
      { frequency: 1975.5, start: 0.26, duration: 0.28, wave: "triangle" },
    ],
  },
  bolha: {
    label: "Bolha de chat",
    group: CHAT,
    notes: [
      { frequency: 400, start: 0, duration: 0.12, wave: "sine", slideTo: 1100 },
      {
        frequency: 600,
        start: 0.14,
        duration: 0.12,
        wave: "sine",
        slideTo: 1500,
      },
    ],
  },
  pop: {
    label: "Pop de mensagem",
    group: CHAT,
    notes: [
      { frequency: 1500, start: 0, duration: 0.09, wave: "sine", slideTo: 500 },
      { frequency: 1100, start: 0.1, duration: 0.14, wave: "triangle" },
    ],
  },
  alerta: {
    label: "Alerta",
    group: URGENT,
    notes: [
      { frequency: 1318.5, start: 0, duration: 0.13, wave: "square" },
      { frequency: 1046.5, start: 0.16, duration: 0.13, wave: "square" },
      { frequency: 1318.5, start: 0.32, duration: 0.13, wave: "square" },
      { frequency: 1046.5, start: 0.48, duration: 0.13, wave: "square" },
    ],
  },
  sirene: {
    label: "Sirene",
    group: URGENT,
    notes: [
      {
        frequency: 700,
        start: 0,
        duration: 0.4,
        wave: "sawtooth",
        slideTo: 1400,
      },
      {
        frequency: 1400,
        start: 0.4,
        duration: 0.4,
        wave: "sawtooth",
        slideTo: 700,
      },
    ],
  },
  telefone: {
    label: "Telefone antigo",
    group: URGENT,
    notes: Array.from({ length: 10 }, (_, i) => ({
      frequency: i % 2 === 0 ? 1100 : 1350,
      start: i * 0.05,
      duration: 0.05,
      wave: "square" as const,
    })),
  },
  sonar: {
    label: "Sonar",
    group: URGENT,
    notes: [
      { frequency: 1480, start: 0, duration: 1.1, wave: "sine" },
      { frequency: 1480, start: 0.55, duration: 0.6, wave: "triangle" },
    ],
  },
} as const satisfies Record<string, Sound>;

export type SoundId = keyof typeof SOUNDS;
export const SOUND_IDS = Object.keys(SOUNDS) as SoundId[];

/** The tones grouped as the settings list shows them, in catalogue order. */
export function soundGroups(): { group: string; ids: SoundId[] }[] {
  const groups: { group: string; ids: SoundId[] }[] = [];
  for (const id of SOUND_IDS) {
    const { group } = SOUNDS[id];
    const found = groups.find((g) => g.group === group);
    if (found) found.ids.push(id);
    else groups.push({ group, ids: [id] });
  }
  return groups;
}

/** How often "repetir até atender" rings, in seconds. */
export const REPEAT_OPTIONS = [10, 15, 30, 60] as const;

export type SoundChoice = SoundId | "none";

function isSoundChoice(value: unknown): value is SoundChoice {
  return value === "none" || (typeof value === "string" && value in SOUNDS);
}

/**
 * The attendant's choices, kept in this browser (each computer at the
 * counter has its own speakers and its own volume). Every field defaults,
 * so a saved value from an older version, or garbage, reads as the
 * defaults rather than failing.
 */
export const AlertPrefsSchema = z.object({
  // "none" is "Sem som": the flash and the notification still work.
  sound: z.custom<SoundChoice>(isSoundChoice).catch("sino" as SoundChoice),
  volume: z
    .number()
    .transform((v) => Math.round(Math.min(100, Math.max(0, v))))
    .catch(90),
  repeat: z.boolean().catch(true),
  repeatSeconds: z
    .number()
    .refine((s) => (REPEAT_OPTIONS as readonly number[]).includes(s))
    .catch(10),
  notify: z.boolean().catch(true),
  flash: z.boolean().catch(true),
  // The panel shakes and the screen flashes "Chat" when an alert lands, the
  // way the messengers of the 2000s called for attention. Behind
  // prefers-reduced-motion like every movement in the panel.
  shake: z.boolean().catch(true),
});
export type AlertPrefs = z.infer<typeof AlertPrefsSchema>;

export const DEFAULT_ALERT_PREFS: AlertPrefs = AlertPrefsSchema.parse({});

/** Reads saved preferences, whatever shape they were saved in. */
export function parseAlertPrefs(raw: unknown): AlertPrefs {
  const object = typeof raw === "object" && raw !== null ? raw : {};
  return AlertPrefsSchema.parse(object);
}

/**
 * The gain a volume (0 to 100) plays at, before the player's own boost and
 * limiter (see app/_components/chat-sound.ts). A gentle curve, not a straight line, because
 * hearing is logarithmic; gentler than squaring, so the top of the slider
 * is loud and the middle still carries across a counter.
 */
export function volumeGain(volume: number): number {
  const v = Math.min(100, Math.max(0, volume)) / 100;
  return v ** 1.5;
}

/**
 * How many of the messages a citizen's chat just received are replies from
 * the office, the ones worth a sound. None on the first load (the
 * conversation reappearing after a reload is not news), and never the
 * citizen's own or a system line ("atendimento encerrado").
 */
export function newStaffReplies(
  fresh: readonly { authorType: string }[],
  firstLoad: boolean,
): number {
  if (firstLoad) return 0;
  return fresh.filter((message) => message.authorType === "staff").length;
}

/** The tone the citizen's chat plays for a reply, at this volume: soft
 * enough for a public page, loud enough to be heard from another tab. */
export const CITIZEN_REPLY_SOUND: SoundId = "bolha";
export const CITIZEN_REPLY_VOLUME = 80;
