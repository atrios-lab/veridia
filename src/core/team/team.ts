import { z } from "zod";

/**
 * The office's team (decision of 18/11/2026): the people of the serventia, by
 * level, shown on the site as a mosaic and kept in the panel by the
 * Tabelião/Registrador. It is its own list, apart from the panel accounts:
 * a person of serviços gerais may never log in, and the levels are the
 * office's to rename and reorder.
 *
 * What the visitor sees is decided here, in one place: a person appears only
 * when marked "Mostrar no site"; the photo only with the image
 * authorization recorded; the portaria (number, date and the file) only
 * when the file was attached, which is what publishes it.
 */

export interface TeamLevel {
  id: string;
  label: string;
}

/** The levels a new office starts with, in order (the Tabelião's list). */
export const DEFAULT_TEAM_LEVELS: readonly TeamLevel[] = [
  { id: "tabeliao", label: "Tabelião e Registrador" },
  { id: "substituto-legal", label: "Substituto legal" },
  { id: "substituto", label: "Substituto" },
  { id: "escrevente-autorizado", label: "Escrevente autorizado" },
  { id: "escrevente", label: "Escrevente" },
  { id: "auxiliar", label: "Auxiliar de cartório" },
  { id: "estagiario", label: "Estagiário(a)" },
  { id: "jovem-aprendiz", label: "Jovem aprendiz" },
  { id: "servicos-gerais", label: "Serviços gerais" },
];

/**
 * Levels added to the default list after offices had already saved their
 * own (decision of 23/11/2026: "faltou a opção de estagiária(o) e Jovem
 * Aprendiz"). A list saved before them gets them once, before "Serviços
 * gerais"; a list saved after (`version` 2) is taken as the office left it,
 * so a level the office removed on purpose does not come back.
 */
const ADDED_IN_VERSION_2: readonly TeamLevel[] = [
  { id: "estagiario", label: "Estagiário(a)" },
  { id: "jovem-aprendiz", label: "Jovem aprendiz" },
];

/** How a list of levels is kept: with the version it was saved under. */
export function storedLevels(levels: readonly TeamLevel[]) {
  return { version: 2, levels: [...levels] };
}

function withAddedLevels(levels: TeamLevel[]): TeamLevel[] {
  const out = [...levels];
  const labels = new Set(
    out.map((level) =>
      level.label.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(),
    ),
  );
  for (const added of ADDED_IN_VERSION_2) {
    const key = added.label.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    if (out.some((level) => level.id === added.id) || labels.has(key)) {
      continue;
    }
    if (out.length >= MAX_LEVELS) break;
    const before = out.findIndex((level) => level.id === "servicos-gerais");
    if (before >= 0) out.splice(before, 0, added);
    else out.push(added);
  }
  return out;
}

export const MAX_LEVELS = 20;
export const LEVEL_LABEL_MAX = 60;

const LEVEL_ID = /^[a-z0-9-]{1,40}$/;

const LevelSchema = z.object({
  id: z.string().regex(LEVEL_ID),
  label: z.string().trim().min(1).max(LEVEL_LABEL_MAX),
});

/** The levels as stored: a broken or empty list reads as the default. A
 * list saved before version 2 gets the levels added since. */
export function levelsFrom(raw: unknown): TeamLevel[] {
  const versioned =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as { version?: unknown; levels?: unknown })
      : undefined;
  if (versioned?.version === 2) return parseLevels(versioned.levels);
  const parsed = parseLevels(raw);
  return Array.isArray(raw) ? withAddedLevels(parsed) : parsed;
}

function parseLevels(raw: unknown): TeamLevel[] {
  if (!Array.isArray(raw)) return [...DEFAULT_TEAM_LEVELS];
  const out: TeamLevel[] = [];
  const seen = new Set<string>();
  for (const item of raw.slice(0, MAX_LEVELS)) {
    const parsed = LevelSchema.safeParse(item);
    if (!parsed.success || seen.has(parsed.data.id)) continue;
    seen.add(parsed.data.id);
    out.push(parsed.data);
  }
  return out.length ? out : [...DEFAULT_TEAM_LEVELS];
}

const withoutAccents = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** A level's address-safe id from its name: "Escrevente júnior" gives "escrevente-junior". */
export function slugFor(label: string): string {
  const slug = withoutAccents(label)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36);
  return slug || "nivel";
}

/** An id for a new level that no other level has. */
export function uniqueLevelId(
  levels: readonly TeamLevel[],
  label: string,
): string {
  const base = slugFor(label);
  const taken = new Set(levels.map((level) => level.id));
  if (!taken.has(base)) return base;
  for (let n = 2; n < 100; n += 1) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${Date.now() % 100000}`;
}

/** Why a list of levels cannot be saved, or null. */
export function checkLevels(levels: readonly TeamLevel[]): string | null {
  if (levels.length === 0) return "Deixe pelo menos um nível.";
  if (levels.length > MAX_LEVELS) {
    return `No máximo ${MAX_LEVELS} níveis.`;
  }
  const names = new Set<string>();
  for (const level of levels) {
    if (!LEVEL_ID.test(level.id)) return "Nível inválido.";
    const label = level.label.trim();
    if (!label) return "Dê um nome a cada nível.";
    if (label.length > LEVEL_LABEL_MAX) {
      return `O nome de um nível pode ter até ${LEVEL_LABEL_MAX} letras.`;
    }
    const key = withoutAccents(label).toLowerCase();
    if (names.has(key)) return `O nível "${label}" aparece duas vezes.`;
    names.add(key);
  }
  return null;
}

/**
 * The level a signer's position text most likely means, for bringing the
 * "Quem assina" list into the team: the same name first, then a level whose
 * name the text contains, else the "Escrevente" one, else the first.
 */
export function guessLevel(
  levels: readonly TeamLevel[],
  title: string,
): string {
  const text = withoutAccents(title).toLowerCase().trim();
  const same = levels.find(
    (level) => withoutAccents(level.label).toLowerCase() === text,
  );
  if (same) return same.id;
  // Longest names first: "Substituto legal" before "Substituto".
  const contained = [...levels]
    .sort((a, b) => b.label.length - a.label.length)
    .find((level) => text.includes(withoutAccents(level.label).toLowerCase()));
  if (contained) return contained.id;
  return (levels.find((l) => l.id === "escrevente") ?? levels[0]).id;
}

export const NAME_MAX = 120;
export const SMALL_TEXT_MAX = 80;

const IsoDay = /^\d{4}-\d{2}-\d{2}$/;

// The photo's frame ---------------------------------------------------------

export const PHOTO_SHAPES = ["circle", "square"] as const;
export const PHOTO_FITS = ["cover", "contain"] as const;
export const ZOOM_MIN = 100;
export const ZOOM_MAX = 300;

/**
 * How a person's photo sits in its frame on the site: the shape (circle or
 * rounded square), "cover" (fills the frame, cutting what overflows) or
 * "contain" (shows the whole photo), and, when it fills, the point of the
 * photo kept in the middle (x and y, 0 to 100) and the zoom (100 to 300).
 */
export const PhotoFrameSchema = z.object({
  shape: z.enum(PHOTO_SHAPES),
  fit: z.enum(PHOTO_FITS),
  x: z.number().int().min(0).max(100),
  y: z.number().int().min(0).max(100),
  zoom: z.number().int().min(ZOOM_MIN).max(ZOOM_MAX),
});
export type PhotoFrame = z.infer<typeof PhotoFrameSchema>;

export const DEFAULT_FRAME: PhotoFrame = {
  shape: "circle",
  fit: "cover",
  x: 50,
  y: 50,
  zoom: 100,
};

/** A stored frame, read leniently: anything wrong falls back to the default. */
export function frameFrom(raw: unknown): PhotoFrame {
  const parsed = PhotoFrameSchema.safeParse(raw);
  return parsed.success ? parsed.data : { ...DEFAULT_FRAME };
}

/** The CSS of the photo inside its frame (shared by the site and the preview). */
export function frameImageStyle(frame: PhotoFrame): {
  objectFit: "cover" | "contain";
  objectPosition: string;
  transform?: string;
  transformOrigin?: string;
} {
  if (frame.fit === "contain") {
    return { objectFit: "contain", objectPosition: "50% 50%" };
  }
  const origin = `${frame.x}% ${frame.y}%`;
  return {
    objectFit: "cover",
    objectPosition: origin,
    ...(frame.zoom > ZOOM_MIN
      ? { transform: `scale(${frame.zoom / 100})`, transformOrigin: origin }
      : {}),
  };
}

/** What the form sends for one person (the files travel apart). */
export const StaffInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Informe o nome da pessoa.")
    .max(NAME_MAX, `O nome pode ter até ${NAME_MAX} letras.`),
  levelId: z.string().regex(LEVEL_ID, "Escolha o nível."),
  profession: z
    .string()
    .trim()
    .max(SMALL_TEXT_MAX, `A profissão pode ter até ${SMALL_TEXT_MAX} letras.`),
  registration: z
    .string()
    .trim()
    .max(
      SMALL_TEXT_MAX,
      `Portaria/Matrícula pode ter até ${SMALL_TEXT_MAX} letras.`,
    ),
  portariaDate: z
    .string()
    .refine((v) => v === "" || IsoDay.test(v), "Data da portaria inválida."),
  showOnSite: z.boolean(),
  imageConsent: z.boolean(),
  canSign: z.boolean(),
  /**
   * Encarregado de Dados (DPO, Lei nº 13.709/2018, art. 41): a function on
   * top of the level, shown on the team and on the LGPD page with the photo
   * (decision of 27/11/2026). Optional: the forms before it leave it out.
   */
  isDpo: z.boolean().default(false),
  /**
   * The Encarregado is not of the team (an outside DPO): no level on the
   * site, apart from the hierarchy (decision of 27/11/2026).
   */
  dpoExternal: z.boolean().default(false),
  /** How the photo sits in its frame; the default is the centred circle. */
  frame: PhotoFrameSchema.default(DEFAULT_FRAME),
});
/** What the form sends (the frame may be left out). */
export type StaffInput = z.input<typeof StaffInputSchema>;
/** What the rules read after checking. */
export type StaffParsed = z.output<typeof StaffInputSchema>;

/** One person as the panel reads it. */
export interface StaffRecord {
  id: string;
  name: string;
  levelId: string;
  profession: string;
  registration: string;
  /** "2026-11-18" or null. */
  portariaDate: string | null;
  position: number;
  showOnSite: boolean;
  imageConsent: boolean;
  canSign: boolean;
  isDpo: boolean;
  dpoExternal: boolean;
  signerOrder: number | null;
  hasPhoto: boolean;
  hasPortaria: boolean;
  hasWord: boolean;
  archived: boolean;
  frame: PhotoFrame;
}

/** One person as the visitor sees them. Never carries a file path. */
export interface PublicPerson {
  id: string;
  name: string;
  levelId: string;
  profession: string;
  /** Empty unless the portaria is attached. */
  registration: string;
  portariaDate: string | null;
  photo: boolean;
  portaria: boolean;
  /** Encarregado de Dados (DPO). */
  dpo: boolean;
  /** Only the DPO function, not of the team: shown without a level. */
  dpoOnly: boolean;
  frame: PhotoFrame;
}

/** The visitor's view of a person, or null when they do not appear. */
export function publicPerson(person: StaffRecord): PublicPerson | null {
  if (!person.showOnSite || person.archived) return null;
  return {
    id: person.id,
    name: person.name,
    levelId: person.levelId,
    profession: person.profession,
    // The portaria is published by attaching it: its number and date only
    // show with the file.
    registration: person.hasPortaria ? person.registration : "",
    portariaDate: person.hasPortaria ? person.portariaDate : null,
    photo: person.hasPhoto && person.imageConsent,
    portaria: person.hasPortaria,
    dpo: person.isDpo,
    dpoOnly: person.isDpo && person.dpoExternal,
    frame: person.frame,
  };
}

export interface TeamGroup<T> {
  level: TeamLevel;
  people: T[];
}

/**
 * The people under their levels, in the level order and, inside a level, in
 * the order the Tabelião set. Levels with nobody are left out. A person
 * whose level is gone goes last, under "Outros", so nobody disappears.
 */
export function groupByLevel<T extends { levelId: string; name: string }>(
  levels: readonly TeamLevel[],
  people: readonly (T & { position?: number })[],
): TeamGroup<T>[] {
  const order = (a: T & { position?: number }, b: T & { position?: number }) =>
    (a.position ?? 0) - (b.position ?? 0) ||
    a.name.localeCompare(b.name, "pt-BR");
  const known = new Set(levels.map((level) => level.id));
  const groups: TeamGroup<T>[] = levels.map((level) => ({
    level,
    people: people.filter((p) => p.levelId === level.id).sort(order),
  }));
  const lost = people.filter((p) => !known.has(p.levelId)).sort(order);
  if (lost.length) {
    groups.push({ level: { id: "outros", label: "Outros" }, people: lost });
  }
  return groups.filter((group) => group.people.length > 0);
}

/**
 * Who "Quem assina" lists once the team feeds it: the people marked "Pode
 * assinar documentos", in the order each took in the list (never the
 * hierarchy's order: the documents keep who signs by its place in this
 * list). The position text is the level's name; the note is the
 * Portaria/Matrícula.
 */
export function signersFrom(
  levels: readonly TeamLevel[],
  people: readonly StaffRecord[],
): { name: string; title: string; note: string }[] {
  return people
    .filter((p) => p.canSign && !p.archived)
    .sort(
      (a, b) =>
        (a.signerOrder ?? Number.MAX_SAFE_INTEGER) -
        (b.signerOrder ?? Number.MAX_SAFE_INTEGER),
    )
    .map((p) => ({
      name: p.name,
      title: levels.find((l) => l.id === p.levelId)?.label ?? "",
      note: p.registration,
    }));
}

// Files -----------------------------------------------------------------

export type TeamFileKind = "photo" | "portaria" | "word";
export type TeamFileType = "png" | "jpeg" | "webp" | "pdf" | "docx" | "doc";

const MB = 1024 * 1024;

export const TEAM_FILE_RULES: Record<
  TeamFileKind,
  { label: string; types: readonly TeamFileType[]; maxBytes: number }
> = {
  photo: { label: "foto", types: ["png", "jpeg", "webp"], maxBytes: 3 * MB },
  portaria: { label: "portaria", types: ["pdf"], maxBytes: 4 * MB },
  word: { label: "Word da portaria", types: ["docx", "doc"], maxBytes: 4 * MB },
};

export const TEAM_MIME: Record<TeamFileType, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
};

const startsWith = (bytes: Uint8Array, signature: readonly number[], at = 0) =>
  signature.every((byte, i) => bytes[at + i] === byte);

/** What the bytes are, by their content, never by the name or the type sent. */
export function sniffTeamFile(
  bytes: Uint8Array,
  fileName: string,
): TeamFileType | null {
  if (bytes.byteLength < 12) return null;
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return "png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return "webp";
  }
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "pdf";
  const name = fileName.toLowerCase();
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) && name.endsWith(".docx")) {
    return "docx";
  }
  if (
    startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]) &&
    name.endsWith(".doc")
  ) {
    return "doc";
  }
  return null;
}

/** The problem with a file for this slot, in words, or the type it is. */
export function checkTeamFile(
  kind: TeamFileKind,
  bytes: Uint8Array,
  fileName: string,
): { ok: true; type: TeamFileType } | { ok: false; message: string } {
  const rule = TEAM_FILE_RULES[kind];
  if (bytes.byteLength === 0) {
    return { ok: false, message: `O arquivo da ${rule.label} está vazio.` };
  }
  if (bytes.byteLength > rule.maxBytes) {
    return {
      ok: false,
      message: `A ${rule.label} pode ter até ${Math.round(rule.maxBytes / MB)} MB.`,
    };
  }
  const type = sniffTeamFile(bytes, fileName);
  if (!type || !rule.types.includes(type)) {
    const accepted: Record<TeamFileKind, string> = {
      photo: "PNG, JPEG ou WebP",
      portaria: "PDF",
      word: "Word (.docx ou .doc)",
    };
    return {
      ok: false,
      message: `Envie ${kind === "photo" ? "a foto" : kind === "portaria" ? "a portaria" : "o Word"} em ${accepted[kind]}.`,
    };
  }
  return { ok: true, type };
}

/** The warning shown, and agreed to, when a portaria is attached. */
export const PORTARIA_PUBLIC_WARNING =
  "Este arquivo fica público: quem entra no site pode abrir. Confira se não tem CPF, endereço ou outros dados pessoais.";
