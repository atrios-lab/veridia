import Link from "next/link";
import type { Tutorial } from "@/core/tutorials/catalog.ts";
import { formatDuration } from "@/core/tutorials/progress.ts";
import { AdminIcon } from "../../../_components/icon.tsx";

/**
 * Every video, the trail first (see `listOrder`), each one a link that swaps
 * the player above. Rendered on the server: which ones are ticked comes
 * from the person's rows, and the current one is the page's own `?video=`.
 */
export function TutorialList({
  tutorials,
  watchedIds,
  currentId,
  screenLabels,
}: {
  tutorials: readonly Tutorial[];
  watchedIds: ReadonlySet<string>;
  currentId: string;
  /** Sidebar label per taught route, for "Pedidos de serviço" under a title. */
  screenLabels: ReadonlyMap<string, string>;
}) {
  return (
    <nav aria-label="Treinamento" className="flex flex-col gap-1.5">
      {tutorials.map((tutorial, index) => {
        const current = tutorial.id === currentId;
        const watched = watchedIds.has(tutorial.id);
        const screen = tutorial.route
          ? screenLabels.get(tutorial.route)
          : undefined;
        return (
          <Link
            key={tutorial.id}
            href={`/admin/ajuda?video=${encodeURIComponent(tutorial.id)}`}
            aria-current={current ? "true" : undefined}
            className={
              current
                ? "flex items-center gap-3 rounded-[10px] border border-admin-active-border bg-admin-surface px-3.5 py-3"
                : "flex items-center gap-3 rounded-[10px] border border-transparent px-3.5 py-3 hover:bg-admin-surface"
            }
          >
            <span
              aria-hidden="true"
              className={
                watched
                  ? "inline-flex h-6 w-6 flex-none items-center justify-center rounded-full bg-admin-success-bg text-admin-success-text"
                  : "inline-flex h-6 w-6 flex-none items-center justify-center rounded-full border border-admin-input-border text-[11px] font-bold text-admin-faint"
              }
            >
              {watched ? (
                <AdminIcon name="check" className="h-3.5 w-3.5" />
              ) : (
                index + 1
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-semibold text-admin-primary">
                {tutorial.title}
              </span>
              <span className="block text-[12px] text-admin-muted">
                {formatDuration(tutorial.durationSeconds)}
                {screen && ` · ${screen}`}
                {!tutorial.trail && " · aprofundamento"}
              </span>
            </span>
            {watched && <span className="sr-only">(assistido)</span>}
          </Link>
        );
      })}
    </nav>
  );
}
