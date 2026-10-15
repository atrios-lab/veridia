import { z } from "zod";

// What the platform may upload as a tutorial, and what the form that
// describes it must say. Pure: the same checks run in the browser before
// the upload starts and on the server before anything is written.

/** The store folder every tutorial file lives under, next to `anexos/`
 * (citizen attachments) and `marca/` (brand images). */
export const TUTORIAL_FOLDER = "treinamento";

export type TutorialFileKind = "video" | "captions";

export const TUTORIAL_MIME_TYPES: Record<TutorialFileKind, string> = {
  video: "video/mp4",
  captions: "text/vtt",
};

const EXTENSIONS: Record<TutorialFileKind, string> = {
  video: "mp4",
  captions: "vtt",
};

/**
 * Straight from the browser to the store, the file never touches a Vercel
 * function, so the ceiling is what a screen recording of a few minutes at
 * 1080p could plausibly weigh, with room to spare.
 */
export const MAX_VIDEO_BYTES_DIRECT = 500 * 1024 * 1024;
/**
 * Through a server action (development, no store configured) the whole
 * form is one request body, capped by `serverActions.bodySizeLimit` in
 * next.config.ts (110 MB). Below that, with room for the rest of the form.
 */
export const MAX_VIDEO_BYTES_SERVER_ACTION = 100 * 1024 * 1024;
/** A WebVTT file is text; a megabyte is an hour of dense captions. */
export const MAX_CAPTIONS_BYTES = 1024 * 1024;

const GENERATED_ID =
  "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const GENERATED_PATH = new RegExp(
  `^${TUTORIAL_FOLDER}/${GENERATED_ID}\\.(mp4|vtt)$`,
);

/** Where a tutorial's file is stored: the folder, the row's id, the kind's
 * extension. The browser proposes this exact name and the token route
 * accepts nothing else. */
export function tutorialFilePath(kind: TutorialFileKind, id: string): string {
  return `${TUTORIAL_FOLDER}/${id}.${EXTENSIONS[kind]}`;
}

/** Whether a pathname is one `tutorialFilePath` would have produced. */
export function isGeneratedTutorialPath(pathname: string): boolean {
  return GENERATED_PATH.test(pathname);
}

/** The kind a generated path stores, read back from its extension. */
export function tutorialPathKind(pathname: string): TutorialFileKind | null {
  if (!isGeneratedTutorialPath(pathname)) return null;
  return pathname.endsWith(".mp4") ? "video" : "captions";
}

/**
 * Whether a stored URL points inside the tutorial folder of the given
 * store host (or, with no host, is a local `/uploads/treinamento/` path).
 * What the server checks before trusting a URL the browser says it
 * uploaded to: the token route only ever authorised names under this
 * folder, so a URL anywhere else was not issued by it.
 */
export function isStoredTutorialUrl(
  url: string,
  blobPublicHost: string | undefined,
): boolean {
  if (blobPublicHost) {
    try {
      const parsed = new URL(url);
      return (
        parsed.protocol === "https:" &&
        parsed.host === blobPublicHost &&
        isGeneratedTutorialPath(parsed.pathname.slice(1))
      );
    } catch {
      return false;
    }
  }
  return new RegExp(
    `^/uploads/${TUTORIAL_FOLDER}/${GENERATED_ID}\\.(mp4|vtt)$`,
  ).test(url);
}

export type TutorialFileProblem =
  | { kind: "type"; mimeType: string }
  | { kind: "size"; limit: number };

export function checkTutorialFile(
  file: { mimeType: string; size: number },
  kind: TutorialFileKind,
  limit: number,
): TutorialFileProblem | null {
  if (file.mimeType !== TUTORIAL_MIME_TYPES[kind]) {
    return { kind: "type", mimeType: file.mimeType };
  }
  if (file.size > limit) return { kind: "size", limit };
  return null;
}

function megabytes(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

export function describeTutorialFileProblem(
  problem: TutorialFileProblem,
  kind: TutorialFileKind,
): string {
  if (problem.kind === "type") {
    return kind === "video"
      ? "O vídeo precisa ser um arquivo MP4."
      : "A legenda precisa ser um arquivo WebVTT (.vtt).";
  }
  return `${kind === "video" ? "O vídeo" : "A legenda"} passa do limite de ${megabytes(problem.limit)}.`;
}

/**
 * The form's fields, validated. Which routes exist is the panel's to say
 * (ADMIN_NAV lives in the app, not here), so the caller hands the allowed
 * list in; an empty string means "no screen, the panel as a whole".
 */
export function tutorialFormSchema(allowedRoutes: readonly string[]) {
  const routes = new Set(allowedRoutes);
  return z.object({
    title: z
      .string()
      .trim()
      .min(1, "Informe o título.")
      .max(120, "O título passa de 120 caracteres."),
    description: z
      .string()
      .trim()
      .max(500, "A descrição passa de 500 caracteres.")
      .default(""),
    durationSeconds: z
      .number()
      .int("Duração inválida.")
      .positive("Não foi possível ler a duração do vídeo."),
    route: z
      .string()
      .trim()
      .refine((value) => value === "" || routes.has(value), "Tela inválida.")
      .transform((value) => (value === "" ? null : value)),
    trail: z.boolean(),
  });
}

export type TutorialFormInput = z.output<ReturnType<typeof tutorialFormSchema>>;
