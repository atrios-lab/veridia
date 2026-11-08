/**
 * A video tutorial as the panel reads it: the shape the player, the trail
 * card and the pure functions in progress.ts consume.
 *
 * The catalog is the `tutorials` table (src/db/schema.ts), the same rows
 * for every office: Átrios records a video once, publishes it from the
 * panel, and every serventia sees it at that moment. It began as a constant
 * in this file, to be edited by pull request; that lasted until the first
 * video was about to be recorded by someone who does not open pull
 * requests. What survived the move is the shape below and the rule that
 * nothing here reads a database: src/lib/tutorials.ts maps a row to this
 * and hands the list, already in trail order, to the functions next door.
 */
/** Apresentação, Aula or Encerramento: where a video sits in its course. */
export type TutorialKind = "intro" | "lesson" | "outro";

export const TUTORIAL_KINDS: readonly TutorialKind[] = [
  "intro",
  "lesson",
  "outro",
];

export function isTutorialKind(value: string): value is TutorialKind {
  return (TUTORIAL_KINDS as readonly string[]).includes(value);
}

/** The course every video made before courses existed belongs to, and the
 * only one the trail, the overview card and "Como usar esta tela" read. */
export const PANEL_COURSE_SLUG = "uso-do-painel";

/** A course as the panel reads it (the `courses` table, see
 * src/db/schema.ts): the files as public URLs. */
export interface Course {
  id: string;
  slug: string;
  title: string;
  description: string;
  posterUrl: string | null;
  /** The support PDF ("apostila"), or null. */
  materialUrl: string | null;
  /** Each video opens only after the one before it. */
  sequential: boolean;
}

export interface Tutorial {
  /** The row's uuid: the key the progress table stores. */
  id: string;
  title: string;
  /** One sentence under the title, in the operator's words. */
  description: string;
  durationSeconds: number;
  /** Public URL of the MP4: the Blob store's, or `/uploads/...` in dev. */
  videoUrl: string;
  /** Public URL of the WebVTT captions, in Portuguese; null when none was
   * uploaded, in which case the player shows no track at all. */
  captionsUrl: string | null;
  /** Public URL of the cover image (JPEG, PNG or WebP); null when none was
   * uploaded, in which case the card draws a cover from the title. */
  posterUrl: string | null;
  /**
   * The panel route this video teaches, e.g. "/admin/pedidos": the screen at
   * that route and its subordinates offer "Como usar esta tela". Null for a
   * video about the panel as a whole (first steps).
   */
  route: string | null;
  /**
   * Part of the "Primeiros passos" trail the overview card walks a newcomer
   * through. A deep dive on one screen stays out of it, so the trail does
   * not grow with every video added.
   */
  trail: boolean;
  courseId: string;
  kind: TutorialKind;
}

/** A course's page, opened at one of its videos when given. */
export function courseHref(slug: string, videoId?: string): string {
  const base = `/admin/ajuda/${encodeURIComponent(slug)}`;
  return videoId ? `${base}?video=${encodeURIComponent(videoId)}` : base;
}
