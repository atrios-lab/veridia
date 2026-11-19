import { NUDGE_SOUND, SOUND_IDS, type SoundId } from "../chat/alerts.ts";

/**
 * What makes the internal messenger feel live (decision of 19/11/2026):
 * "digitando…", the reactions under a message, the ready answers, and each
 * person's own sounds. Pure rules, no I/O.
 */

/* --------------------------------------------------------------- typing */

/** How often the screen says "still typing" while keys are pressed. */
export const TYPING_PING_MS = 2500;
/** After this long without a ping, "digitando…" goes away by itself. */
export const TYPING_TTL_MS = 6000;

/** Whether a ping is fresh enough to show "digitando…". */
export function isTyping(typingAt: Date | null, now: Date): boolean {
  return (
    typingAt !== null &&
    now.getTime() - typingAt.getTime() >= -1000 &&
    now.getTime() - typingAt.getTime() < TYPING_TTL_MS
  );
}

/* ------------------------------------------------------------ reactions */

export interface ReactionRow {
  userId: string;
  name: string;
  emoji: string;
}

export interface ReactionSummary {
  emoji: string;
  count: number;
  /** Whether the viewer is one of them: a click takes it back. */
  mine: boolean;
  /** Who reacted, for the tooltip. */
  names: string[];
}

/** The chips under a message: one per emoji, the most chosen first. */
export function summarizeReactions(
  rows: readonly ReactionRow[],
  viewerId: string,
): ReactionSummary[] {
  const byEmoji = new Map<string, ReactionSummary & { first: number }>();
  rows.forEach((row, index) => {
    const entry = byEmoji.get(row.emoji) ?? {
      emoji: row.emoji,
      count: 0,
      mine: false,
      names: [],
      first: index,
    };
    entry.count += 1;
    entry.mine ||= row.userId === viewerId;
    entry.names.push(row.userId === viewerId ? "Você" : row.name);
    byEmoji.set(row.emoji, entry);
  });
  return [...byEmoji.values()]
    .sort((a, b) => b.count - a.count || a.first - b.first)
    .map(({ first: _first, ...summary }) => summary);
}

/* -------------------------------------------------------- ready answers */

/** One click fills the box with these; Enter sends. */
export const QUICK_REPLIES = [
  "👍 Ok",
  "Já vou",
  "Pode passar",
  "Um minuto",
  "Obrigado!",
] as const;

/* --------------------------------------------------------------- sounds */

/** "O som da serventia": the tone the office chose for the channel. */
export const OFFICE_SOUND = "serventia";

export interface SoundPrefs {
  /** A tone, "serventia" (the office's choice) or "none". */
  messageSound: SoundId | typeof OFFICE_SOUND | "none";
  nudgeSound: SoundId;
  /** 0 to 100. */
  volume: number;
  inChat: boolean;
  inBackground: boolean;
  repeatUntilRead: boolean;
  /** "Não perturbe" until then, ISO, or null. */
  quietUntil: string | null;
}

export const DEFAULT_SOUND_PREFS: SoundPrefs = {
  messageSound: OFFICE_SOUND,
  nudgeSound: NUDGE_SOUND,
  volume: 80,
  inChat: true,
  inBackground: true,
  repeatUntilRead: true,
  quietUntil: null,
};

const isSoundId = (value: unknown): value is SoundId =>
  typeof value === "string" && (SOUND_IDS as string[]).includes(value);

/** What a stored row (or a form) says, with anything odd falling back. */
export function soundPrefsFrom(row: {
  messageSound?: string | null;
  nudgeSound?: string | null;
  soundVolume?: number | null;
  soundInChat?: boolean | null;
  soundInBackground?: boolean | null;
  repeatUntilRead?: boolean | null;
  quietUntil?: Date | string | null;
}): SoundPrefs {
  const quiet =
    row.quietUntil instanceof Date
      ? row.quietUntil.toISOString()
      : typeof row.quietUntil === "string" &&
          !Number.isNaN(Date.parse(row.quietUntil))
        ? new Date(row.quietUntil).toISOString()
        : null;
  return {
    messageSound:
      row.messageSound === "none" || row.messageSound === OFFICE_SOUND
        ? row.messageSound
        : isSoundId(row.messageSound)
          ? row.messageSound
          : DEFAULT_SOUND_PREFS.messageSound,
    nudgeSound: isSoundId(row.nudgeSound)
      ? row.nudgeSound
      : DEFAULT_SOUND_PREFS.nudgeSound,
    volume:
      typeof row.soundVolume === "number" && Number.isFinite(row.soundVolume)
        ? Math.min(100, Math.max(0, Math.round(row.soundVolume)))
        : DEFAULT_SOUND_PREFS.volume,
    inChat: row.soundInChat ?? DEFAULT_SOUND_PREFS.inChat,
    inBackground: row.soundInBackground ?? DEFAULT_SOUND_PREFS.inBackground,
    repeatUntilRead: row.repeatUntilRead ?? DEFAULT_SOUND_PREFS.repeatUntilRead,
    quietUntil: quiet,
  };
}

/** "Não perturbe" lengths offered, in minutes; "até amanhã" is its own. */
export const QUIET_OPTIONS = [30, 60] as const;

/** Until when "não perturbe" holds: so many minutes, or tomorrow at 7h. */
export function quietUntilFrom(
  choice: number | "amanha",
  now: Date,
  timeZoneOffsetMinutes = -180,
): Date {
  if (choice !== "amanha") return new Date(now.getTime() + choice * 60_000);
  // Tomorrow 07:00 in the office's clock (UTC-3 unless told otherwise).
  const local = new Date(now.getTime() + timeZoneOffsetMinutes * 60_000);
  const tomorrow = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate() + 1,
    7,
  );
  return new Date(tomorrow - timeZoneOffsetMinutes * 60_000);
}

/**
 * Whether a message that just arrived makes a sound, and which. Silent in
 * "não perturbe", with the sound off, with the panel out of sight when the
 * person asked for that, and for the conversation already open on screen
 * when the person asked for that. A call for attention uses its own tone.
 */
export function toneFor(
  prefs: SoundPrefs,
  context: {
    nudge: boolean;
    /** The office's tone for the channel, "none" when it set none. */
    officeSound: SoundId | "none";
    /** The panel's tab is out of sight. */
    hidden: boolean;
    /** The message is in the conversation open on screen. */
    inOpenConversation: boolean;
    now: Date;
  },
): SoundId | null {
  if (prefs.quietUntil && Date.parse(prefs.quietUntil) > context.now.getTime())
    return null;
  if (context.hidden && !prefs.inBackground) return null;
  if (context.inOpenConversation && !context.hidden && !prefs.inChat)
    return null;
  if (context.nudge) return prefs.nudgeSound;
  if (prefs.messageSound === "none") return null;
  if (prefs.messageSound === OFFICE_SOUND) {
    return context.officeSound === "none" ? null : context.officeSound;
  }
  return prefs.messageSound;
}

/* ------------------------------------------------------- read receipts */

/** ✓ sent, ✓✓ grey delivered (seen online since), ✓✓ blue read. */
export type Receipt = "pendente" | "enviada" | "entregue" | "lida";

export function receiptOf(
  message: { createdAt: string; pending?: boolean },
  other: { readAt: string | null; seenAt: string | null },
): Receipt {
  if (message.pending) return "pendente";
  const at = Date.parse(message.createdAt);
  if (other.readAt && Date.parse(other.readAt) >= at) return "lida";
  if (other.seenAt && Date.parse(other.seenAt) >= at) return "entregue";
  return "enviada";
}

export const RECEIPT_LABELS: Record<Receipt, string> = {
  pendente: "Enviando",
  enviada: "Enviada",
  entregue: "Entregue",
  lida: "Lida",
};
