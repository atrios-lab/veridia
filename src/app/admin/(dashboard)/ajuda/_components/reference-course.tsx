import {
  type Course,
  courseHref,
  type Tutorial,
} from "@/core/tutorials/catalog.ts";
import {
  isTutorialId,
  listOrder,
  nextUnwatched,
  type TrailStatus,
  trailProgress,
  trailStatus,
} from "@/core/tutorials/progress.ts";
import { ADMIN_NAV } from "../../../_components/nav.ts";
import { TutorialCard } from "./tutorial-card.tsx";
import { TutorialPlayer } from "./tutorial-player.tsx";
import { TutorialShelf } from "./tutorial-shelf.tsx";

const PANEL_SCREENS = ADMIN_NAV.filter((item) => !item.external);

// "Pedidos de serviço" next to a video that teaches /admin/pedidos: the
// sidebar's own words, so the screen never has two names.
const SCREEN_LABELS = new Map(
  PANEL_SCREENS.map((item) => [item.href, item.label]),
);

// "Operação" over the card of that same video: the sidebar group the
// screen sits in. A video about the panel as a whole has no screen, and
// so no group; it reads "Painel".
const SCREEN_GROUPS = new Map(
  PANEL_SCREENS.map((item) => [item.href, item.group]),
);
const NO_SCREEN_CATEGORY = "Painel";

function badgeText(status: TrailStatus): string {
  switch (status.kind) {
    case "start":
      return "Comece por aqui";
    case "progress":
      return `Continue de onde parou · ${status.watched} de ${status.total}`;
    case "done":
      return "Trilha concluída";
  }
}

/**
 * A reference course ("Uso do painel"): the featured video with the trail
 * badge, then the shelves, "Primeiros passos" (the trail) and
 * "Aprofundamento" (the rest). Any video opens in any order.
 *
 * An unknown id (or a draft's, which is the same thing from here) is not a
 * 404: the person followed a stale link, and the screen they wanted is
 * this one. The next trail video is the best guess, then whatever comes
 * first.
 */
export function ReferenceCourse({
  course,
  tutorials,
  watchedIds,
  requestedId,
}: {
  course: Course;
  /** The course's published videos, by position. */
  tutorials: readonly Tutorial[];
  watchedIds: ReadonlySet<string>;
  requestedId: string | undefined;
}) {
  const ordered = listOrder(tutorials);
  const trail = ordered.filter((t) => t.trail);
  const deepDives = ordered.filter((t) => !t.trail);
  const current =
    (requestedId && isTutorialId(tutorials, requestedId)
      ? tutorials.find((t) => t.id === requestedId)
      : undefined) ??
    nextUnwatched(tutorials, watchedIds) ??
    ordered[0];
  const progress = trailProgress(tutorials, watchedIds);

  if (!current) return null;

  function card(tutorial: Tutorial) {
    return (
      <TutorialCard
        key={tutorial.id}
        tutorial={tutorial}
        watched={watchedIds.has(tutorial.id)}
        current={tutorial.id === current?.id}
        category={
          (tutorial.route && SCREEN_GROUPS.get(tutorial.route)) ||
          NO_SCREEN_CATEGORY
        }
        screen={tutorial.route ? SCREEN_LABELS.get(tutorial.route) : undefined}
        href={courseHref(course.slug, tutorial.id)}
      />
    );
  }

  return (
    <>
      <TutorialPlayer
        key={current.id}
        tutorial={current}
        watched={watchedIds.has(current.id)}
        screenLabel={
          current.route ? (SCREEN_LABELS.get(current.route) ?? null) : null
        }
        badge={badgeText(trailStatus(tutorials, watchedIds))}
      />
      {trail.length > 0 && (
        <TutorialShelf
          title="Primeiros passos"
          count={`${progress.watched} de ${progress.total}`}
          subtitle="O essencial para usar o painel, na ordem"
          currentId={current.id}
        >
          {trail.map(card)}
        </TutorialShelf>
      )}
      {deepDives.length > 0 && (
        <TutorialShelf
          title="Aprofundamento"
          count={String(deepDives.length)}
          subtitle="Cada tela em detalhe, para quando precisar"
          currentId={current.id}
        >
          {deepDives.map(card)}
        </TutorialShelf>
      )}
    </>
  );
}
