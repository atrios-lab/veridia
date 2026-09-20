import type { Tutorial } from "./catalog.ts";

// What the panel derives from the catalog and the set of ids a person has
// watched. Pure: the catalog is a constant and the watched ids come from
// one query, so nothing here touches a database or a request.

export interface TrailProgress {
  watched: number;
  total: number;
}

/** How far along the "Primeiros passos" trail a person is. Only trail
 * videos count: a deep dive left unwatched never keeps the trail open. */
export function trailProgress(
  catalog: readonly Tutorial[],
  watchedIds: ReadonlySet<string>,
): TrailProgress {
  const trail = catalog.filter((t) => t.trail);
  return {
    watched: trail.filter((t) => watchedIds.has(t.id)).length,
    total: trail.length,
  };
}

/** The first trail video not yet watched, in catalog order; undefined once
 * the trail is complete (or empty). */
export function nextUnwatched(
  catalog: readonly Tutorial[],
  watchedIds: ReadonlySet<string>,
): Tutorial | undefined {
  return catalog.find((t) => t.trail && !watchedIds.has(t.id));
}

/** The order the Treinamento screen lists in: the trail first, in its own
 * order, then everything else in catalog order. A stable partition, not a
 * sort by any key. */
export function listOrder(catalog: readonly Tutorial[]): Tutorial[] {
  return [
    ...catalog.filter((t) => t.trail),
    ...catalog.filter((t) => !t.trail),
  ];
}

export function isTutorialId(
  catalog: readonly Tutorial[],
  id: string,
): boolean {
  return catalog.some((t) => t.id === id);
}

/**
 * Whether `route` covers `pathname`: itself and its subordinates
 * ("/admin/pedidos" covers "/admin/pedidos/novo"), except the panel root,
 * which covers only itself. Without that exception a first-steps video
 * pinned to "/admin" would surface on every screen, and the screens with a
 * video of their own would still win only by length.
 */
function covers(route: string, pathname: string): boolean {
  if (route === "/admin") return pathname === "/admin";
  return pathname === route || pathname.startsWith(`${route}/`);
}

/**
 * The video whose route covers this screen, the most specific one when
 * several do. Undefined when no video teaches the screen, which is what
 * keeps "Como usar esta tela" off the screens that have nothing to say.
 */
export function tutorialForRoute(
  catalog: readonly Tutorial[],
  pathname: string,
): Tutorial | undefined {
  let best: Tutorial | undefined;
  for (const tutorial of catalog) {
    if (tutorial.route === null || !covers(tutorial.route, pathname)) continue;
    if (!best || tutorial.route.length > (best.route as string).length) {
      best = tutorial;
    }
  }
  return best;
}

/** "4 min", "12 min", "45 s": the duration as the list shows it. */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  return `${Math.round(seconds / 60)} min`;
}
