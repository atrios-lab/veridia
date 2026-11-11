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
export const STATUSES = ["disponivel", "ocupado", "ausente"] as const;
export type Status = (typeof STATUSES)[number];
export type Presence = Status | "offline";

export const STATUS_LABELS: Record<Presence, string> = {
  disponivel: "Disponível",
  ocupado: "Ocupado",
  ausente: "Ausente",
  offline: "Offline",
};

/** Seen within this long counts as online (the screen polls every few s). */
export const ONLINE_WINDOW_MS = 90_000;

/** What the others see: the chosen status while online, offline otherwise. */
export function presenceOf(
  status: string | null | undefined,
  lastSeenAt: Date | null | undefined,
  now: Date,
): Presence {
  if (!lastSeenAt || now.getTime() - lastSeenAt.getTime() > ONLINE_WINDOW_MS) {
    return "offline";
  }
  return (STATUSES as readonly string[]).includes(status ?? "")
    ? (status as Status)
    : "disponivel";
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
export const MAX_TEXT = 4000;

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

/** The notice everyone sees: the conversations are not private from the holder. */
export const OVERSIGHT_NOTICE =
  "As mensagens internas são do trabalho da serventia: o Tabelião/Registrador pode ler todas as conversas.";

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return `${parts[0]?.[0] ?? ""}${parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : ""}`.toUpperCase();
}
