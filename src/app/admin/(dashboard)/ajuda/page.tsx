import Link from "next/link";
import { can } from "@/core/auth/roles.ts";
import type { Tutorial } from "@/core/tutorials/catalog.ts";
import {
  isTutorialId,
  listOrder,
  nextUnwatched,
  type TrailStatus,
  trailProgress,
  trailStatus,
} from "@/core/tutorials/progress.ts";
import { getSession } from "@/lib/session.ts";
import { listPublishedTutorials, listWatchedIds } from "@/lib/tutorials.ts";
import { ADMIN_NAV } from "../../_components/nav.ts";
import { AdminPageHeader } from "../../_components/page-header.tsx";
import { TutorialCard } from "./_components/tutorial-card.tsx";
import { TutorialPlayer } from "./_components/tutorial-player.tsx";
import { TutorialShelf } from "./_components/tutorial-shelf.tsx";

export const metadata = { title: "Treinamento" };

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
 * Open to every panel user: the layout has already required a session with
 * `admin.access`, and there is nothing here to protect beyond that. What is
 * the person's own (the ticks) is read by their own id. Only published
 * videos reach this screen; the platform account manages the rest one
 * screen deeper.
 */
export default async function TutorialsPage({
  searchParams,
}: {
  searchParams: Promise<{ video?: string }>;
}) {
  const session = await getSession();
  // The layout redirects before this renders; the check keeps the type.
  if (!session) return null;
  const { video } = await searchParams;
  const [tutorials, watchedIds] = await Promise.all([
    listPublishedTutorials(),
    listWatchedIds(session.user.id),
  ]);
  const ordered = listOrder(tutorials);
  const trail = ordered.filter((t) => t.trail);
  const deepDives = ordered.filter((t) => !t.trail);
  const canManage = can(session.user.role ?? "", "tutorials.manage");

  // An unknown id (or a draft's, which is the same thing from here) is not
  // a 404: the person followed a stale link, and the screen they wanted is
  // this one. The next trail video is the best guess, then whatever comes
  // first.
  const current =
    (video && isTutorialId(tutorials, video)
      ? tutorials.find((t) => t.id === video)
      : undefined) ??
    nextUnwatched(tutorials, watchedIds) ??
    ordered[0];
  const progress = trailProgress(tutorials, watchedIds);

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
      />
    );
  }

  return (
    <>
      <AdminPageHeader
        title="Treinamento"
        description="Vídeos curtos mostrando cada tela do painel, do jeito que ela é usada no dia a dia."
        actions={
          canManage ? (
            <Link
              href="/admin/ajuda/gerenciar"
              className="btn btn-admin-secondary btn-md"
            >
              Gerenciar vídeos
            </Link>
          ) : undefined
        }
      />
      <main className="flex min-w-0 flex-col gap-9 px-[30px] py-7">
        {current ? (
          <>
            <TutorialPlayer
              key={current.id}
              tutorial={current}
              watched={watchedIds.has(current.id)}
              screenLabel={
                current.route
                  ? (SCREEN_LABELS.get(current.route) ?? null)
                  : null
              }
              badge={badgeText(trailStatus(tutorials, watchedIds))}
            />
            {trail.length > 0 && (
              <TutorialShelf
                title="Primeiros passos"
                count={`${progress.watched} de ${progress.total}`}
                subtitle="O essencial para usar o painel, na ordem"
              >
                {trail.map(card)}
              </TutorialShelf>
            )}
            {deepDives.length > 0 && (
              <TutorialShelf
                title="Aprofundamento"
                count={String(deepDives.length)}
                subtitle="Cada tela em detalhe, para quando precisar"
              >
                {deepDives.map(card)}
              </TutorialShelf>
            )}
          </>
        ) : (
          <div className="rounded-[14px] border border-admin-border bg-admin-card px-6 py-10 text-center">
            <p className="font-serif text-[18px] font-semibold text-admin-primary">
              Os vídeos de treinamento estão sendo preparados
            </p>
            <p className="mx-auto mt-2 max-w-[440px] text-[13.5px] leading-normal text-admin-muted">
              Assim que o primeiro estiver pronto, ele aparece aqui e na Visão
              geral, sem precisar fazer nada.
            </p>
          </div>
        )}
      </main>
    </>
  );
}
