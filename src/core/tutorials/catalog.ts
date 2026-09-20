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
