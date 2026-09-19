/**
 * The platform's video tutorials, as code.
 *
 * Every other module of the panel is the office's own content: a table with
 * a tenant slug, edited by the office, gated by `content.edit`. A tutorial
 * is the opposite. Átrios records it once, every office watches the same
 * one, and it changes at the pace of a deploy. So the catalog lives here,
 * typed, reviewed in a pull request like any other text of the panel, and
 * there is no screen to manage it: a table without a tenant slug that only
 * the platform account may edit would be a first for this codebase, and
 * nothing here needs it yet. The day the list is long enough to hurt, the
 * `Tutorial` type is already the row.
 *
 * Publishing a video is three steps, none of them in the application:
 * upload the MP4 (H.264, 1080p, a few minutes at most) and its WebVTT
 * captions to the Blob store through the Vercel dashboard, add an entry
 * below with both URLs, open the pull request. The middleware derives
 * `media-src` from these URLs (see `mediaHosts`), so a new host takes
 * effect with the same deploy. catalog.test.ts keeps every entry honest:
 * unique ids, a route the panel actually has, https URLs.
 *
 * Record over the Homolog seed, never over production: a citizen's name on
 * screen is a data incident for as long as the video exists.
 */
export interface Tutorial {
  /** Stable slug: the key the progress table stores. Never renamed. */
  id: string;
  title: string;
  /** One sentence under the title, in the operator's words. */
  description: string;
  durationSeconds: number;
  /** Full https URL of the MP4. */
  videoUrl: string;
  /** Full https URL of the WebVTT captions, in Portuguese. */
  captionsUrl: string;
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
}

/** In trail order. Empty until the first video is recorded and uploaded. */
export const TUTORIALS: readonly Tutorial[] = [];
