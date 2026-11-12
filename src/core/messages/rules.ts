import { LONG_TEXT_MAX } from "../text-limits.ts";
import { OFFICE_TIME_ZONE } from "../time/office-time.ts";
/**
 * Mensagens internas (decision of 11/11/2026): the office's own messenger,
 * person to person, in the spirit of the desktop messengers of the 2000s:
 * a contact list with photos and status, "Fulano diz:", a sound when a
 * message lands and "chamar atenção" that shakes the other one's screen.
 * The Tabelião/Registrador reads every conversation of the office, and
 * everyone is told so on the screen.
 *
 * Pure rules here; storage in lib/messages.ts.
 */

/** What a message carries. */
export const MESSAGE_KINDS = ["texto", "arquivo", "audio", "chamar"] as const;
export type MessageKind = (typeof MESSAGE_KINDS)[number];

/** The status each person picks, as the contact list shows it. */
export const STATUSES = [
  "disponivel",
  "em-atendimento",
  "em-reuniao",
  "ocupado",
  "ausente",
] as const;
export type Status = (typeof STATUSES)[number];
/** "almoco" is never chosen: the approved lunch window sets it. */
export type Presence = Status | "almoco" | "offline";

export const STATUS_LABELS: Record<Presence, string> = {
  disponivel: "Disponível",
  "em-atendimento": "Em atendimento no balcão",
  "em-reuniao": "Em reunião",
  ocupado: "Ocupado",
  ausente: "Ausente",
  almoco: "Horário de almoço",
  offline: "Offline",
};

/* ------------------------------------------------------------------ lunch */

/** At most an hour a day (decision of 11/11/2026). */
export const MAX_LUNCH_MINUTES = 60;
export const MIN_LUNCH_MINUTES = 15;

export interface Lunch {
  start: string;
  minutes: number;
}

/** "12:00" and 15 to 60 minutes; anything else is refused. */
export function validLunch(start: string, minutes: number): string | null {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start)) {
    return "Informe o início do almoço (hora e minuto).";
  }
  if (
    !Number.isInteger(minutes) ||
    minutes < MIN_LUNCH_MINUTES ||
    minutes > MAX_LUNCH_MINUTES
  ) {
    return `O almoço vai de ${MIN_LUNCH_MINUTES} minutos a 1 hora por dia.`;
  }
  return null;
}

/** "12:00 às 13:00". */
export function lunchLabel(lunch: Lunch): string {
  const [h, m] = lunch.start.split(":").map(Number);
  const end = h * 60 + m + lunch.minutes;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${lunch.start} às ${pad(Math.floor(end / 60) % 24)}:${pad(end % 60)}`;
}

/** Minutes since midnight, in the office's time zone. */
function officeMinutes(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: OFFICE_TIME_ZONE,
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

export function inLunch(lunch: Lunch | null | undefined, now: Date): boolean {
  if (!lunch || validLunch(lunch.start, lunch.minutes)) return false;
  const [h, m] = lunch.start.split(":").map(Number);
  const start = h * 60 + m;
  const at = officeMinutes(now);
  return at >= start && at < start + lunch.minutes;
}

/**
 * When today's lunch window began, while it is on; null outside it.
 */
export function lunchStartedAt(
  lunch: Lunch | null | undefined,
  now: Date,
): Date | null {
  if (!inLunch(lunch, now) || !lunch) return null;
  const [h, m] = lunch.start.split(":").map(Number);
  const since = officeMinutes(now) - (h * 60 + m);
  const start = new Date(now.getTime() - since * 60_000);
  start.setSeconds(0, 0);
  return start;
}

/**
 * At lunch, with the chat locked (decision of 11/11/2026): inside the
 * approved window, unless the person said "voltei do almoço" in it.
 */
export function atLunch(
  lunch: Lunch | null | undefined,
  returnedAt: Date | null | undefined,
  now: Date,
): boolean {
  const start = lunchStartedAt(lunch, now);
  if (!start) return false;
  return !(returnedAt && returnedAt.getTime() >= start.getTime());
}

/* ------------------------------------------------- statuses that linger */

/**
 * The statuses that keep a person out of reach (decision of 11/11/2026):
 * after 40 minutes the Tabelião/Registrador is told; after 60 the person
 * shows as available again on their own. Lunch is apart: it has its own
 * window.
 */
export const AWAY_STATUSES: readonly Status[] = [
  "em-atendimento",
  "em-reuniao",
  "ocupado",
  "ausente",
];
export const STATUS_ALERT_MINUTES = 40;
export const STATUS_RESET_MINUTES = 60;

function minutesSince(at: Date | null | undefined, now: Date): number {
  return at ? (now.getTime() - at.getTime()) / 60_000 : 0;
}

export function isAway(status: string | null | undefined): boolean {
  return (AWAY_STATUSES as readonly string[]).includes(status ?? "");
}

/** The status as it stands now: an away status past 60 minutes is over. */
export function effectiveStatus(
  status: string | null | undefined,
  changedAt: Date | null | undefined,
  now: Date,
): Status {
  if (!(STATUSES as readonly string[]).includes(status ?? "")) {
    return "disponivel";
  }
  if (isAway(status) && minutesSince(changedAt, now) >= STATUS_RESET_MINUTES) {
    return "disponivel";
  }
  return status as Status;
}

/** Between 40 and 60 minutes away: the holder is told. */
export function lingering(
  status: string | null | undefined,
  changedAt: Date | null | undefined,
  now: Date,
): boolean {
  const minutes = minutesSince(changedAt, now);
  return (
    isAway(status) &&
    minutes >= STATUS_ALERT_MINUTES &&
    minutes < STATUS_RESET_MINUTES
  );
}

/** Seen within this long counts as online (the screen polls every few s). */
export const ONLINE_WINDOW_MS = 90_000;

/** What the others see: the chosen status while online, offline otherwise. */
export function presenceOf(
  status: string | null | undefined,
  lastSeenAt: Date | null | undefined,
  now: Date,
  lunch?: Lunch | null,
  times: {
    statusChangedAt?: Date | null;
    lunchReturnedAt?: Date | null;
  } = {},
): Presence {
  if (!lastSeenAt || now.getTime() - lastSeenAt.getTime() > ONLINE_WINDOW_MS) {
    return "offline";
  }
  // The approved lunch window, and only it, shows "almoço": once it is
  // over the person shows as chosen again, so lunch cannot become a way
  // of staying unreachable.
  if (atLunch(lunch, times.lunchReturnedAt, now)) return "almoco";
  return effectiveStatus(status, times.statusChangedAt, now);
}

/** The window's colour each person chooses: tokens, not free hex. */
export const COLORS = ["verde", "azul", "vinho", "grafite", "dourado"] as const;
export type MessengerColor = (typeof COLORS)[number];

export const COLOR_LABELS: Record<MessengerColor, string> = {
  verde: "Verde serventia",
  azul: "Azul clássico",
  vinho: "Vinho",
  grafite: "Grafite",
  dourado: "Dourado",
};

export function isColor(value: string): value is MessengerColor {
  return (COLORS as readonly string[]).includes(value);
}

/**
 * The files people trade at work: documents, spreadsheets, images, PDFs,
 * plain text, and voice notes. Nothing that runs. Checked on the server
 * against the file's declared type and extension together.
 */
export const FILE_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "text/plain": "txt",
  "text/csv": "csv",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    "pptx",
  "application/vnd.oasis.opendocument.text": "odt",
  "application/vnd.oasis.opendocument.spreadsheet": "ods",
  "application/zip": "zip",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/aac": "aac",
  "audio/wav": "wav",
};

/** A request carries about 4.5 MB on the host: files stay under 4 MB. */
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
export const MAX_TEXT = LONG_TEXT_MAX;

/** The type to store a file as, or null when it is not accepted. */
export function acceptedType(name: string, declared: string): string | null {
  const type = declared.split(";")[0]?.trim().toLowerCase() ?? "";
  if (type in FILE_TYPES) return type;
  // Some browsers send no type for Office files: go by the extension.
  const extension = name.toLowerCase().split(".").at(-1) ?? "";
  const byExtension = Object.entries(FILE_TYPES).find(
    ([, ext]) => ext === extension,
  );
  return byExtension ? byExtension[0] : null;
}

export function isAudio(mimeType: string): boolean {
  return mimeType.startsWith("audio/");
}

export function isImage(mimeType: string): boolean {
  return mimeType.startsWith("image/") && mimeType !== "image/heic";
}

/** "Chamar atenção" at most once in this long per person and conversation. */
export const NUDGE_COOLDOWN_MS = 15_000;

export function canNudge(lastNudgeAt: Date | null, now: Date): boolean {
  return (
    !lastNudgeAt || now.getTime() - lastNudgeAt.getTime() >= NUDGE_COOLDOWN_MS
  );
}

// No notice on the chat screens that the holder reads the conversations
// (decision of 11/11/2026): the oversight stays, silent.

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return `${parts[0]?.[0] ?? ""}${parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : ""}`.toUpperCase();
}
