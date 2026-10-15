import Link from "next/link";
import { can } from "@/core/auth/roles.ts";
import {
  isTutorialId,
  listOrder,
  nextUnwatched,
  trailProgress,
} from "@/core/tutorials/progress.ts";
import { getSession } from "@/lib/session.ts";
import { listPublishedTutorials, listWatchedIds } from "@/lib/tutorials.ts";
import { ADMIN_NAV } from "../../_components/nav.ts";
import { AdminPageHeader } from "../../_components/page-header.tsx";
import { TutorialList } from "./_components/tutorial-list.tsx";
import { TutorialPlayer } from "./_components/tutorial-player.tsx";

export const metadata = { title: "Treinamento" };

// "Pedidos de serviço" next to a video that teaches /admin/pedidos: the
// sidebar's own words, so the list never names a screen two ways.
const SCREEN_LABELS = new Map(
  ADMIN_NAV.filter((item) => !item.external).map((item) => [
    item.href,
    item.label,
  ]),
);

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

  return (
    <>
      <AdminPageHeader
        title="Treinamento"
        description={
          progress.total > 0
            ? `Primeiros passos: ${progress.watched} de ${progress.total} assistidos. Cada vídeo mostra uma tela do painel, do jeito que ela é usada no dia a dia.`
            : "Cada vídeo mostra uma tela do painel, do jeito que ela é usada no dia a dia."
        }
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
      <main className="flex flex-col gap-4.5 px-[30px] py-7">
        {current ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_348px] lg:items-start">
            <TutorialPlayer
              key={current.id}
              tutorial={current}
              watched={watchedIds.has(current.id)}
              screenLabel={
                current.route
                  ? (SCREEN_LABELS.get(current.route) ?? null)
                  : null
              }
            />
            <div className="rounded-[14px] border border-admin-border bg-admin-card p-3">
              <span className="block px-3.5 pt-2 pb-2.5 text-[11px] font-bold uppercase tracking-[0.08em] text-admin-faint">
                Todos os vídeos
              </span>
              <TutorialList
                tutorials={ordered}
                watchedIds={watchedIds}
                currentId={current.id}
                screenLabels={SCREEN_LABELS}
              />
            </div>
          </div>
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
