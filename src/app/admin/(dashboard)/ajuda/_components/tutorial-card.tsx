import Link from "next/link";
import type { Tutorial } from "@/core/tutorials/catalog.ts";
import { formatDuration } from "@/core/tutorials/progress.ts";
import { AdminIcon } from "../../../_components/icon.tsx";
import { TutorialCover } from "./tutorial-cover.tsx";

/**
 * One video on a shelf: the cover with the duration and the watched tick on
 * top, then the category, the title and the screen it teaches. A link that
 * swaps the featured video, like the list it replaced; rendered on the
 * server, since which ones are ticked comes from the person's rows and the
 * current one is the page's own `?video=`.
 */
export function TutorialCard({
  tutorial,
  watched,
  current,
  category,
  screen,
}: {
  tutorial: Tutorial;
  watched: boolean;
  current: boolean;
  /** The sidebar group of the taught screen, or "Painel". */
  category: string;
  /** The sidebar label of the taught screen, if any. */
  screen: string | undefined;
}) {
  return (
    <Link
      href={`/admin/ajuda?video=${encodeURIComponent(tutorial.id)}`}
      aria-current={current ? "true" : undefined}
      className={`group flex h-full flex-col overflow-hidden rounded-[14px] border bg-admin-card transition-colors duration-120 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-focus-ring ${
        current
          ? "border-admin-primary ring-1 ring-admin-primary"
          : "border-admin-border hover:border-admin-input-border"
      }`}
    >
      <TutorialCover title={tutorial.title} posterUrl={tutorial.posterUrl}>
        {watched && (
          <span
            aria-hidden="true"
            className="absolute top-2.5 right-2.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-admin-success-text text-white shadow-sm"
          >
            <AdminIcon name="check" className="h-3.5 w-3.5" strokeWidth={2.4} />
          </span>
        )}
        {current && (
          <span className="absolute top-2.5 left-2.5 rounded-full bg-admin-primary px-2 py-0.5 text-[10.5px] font-bold text-white shadow-sm">
            Assistindo
          </span>
        )}
        <span className="absolute right-2.5 bottom-2.5 rounded-[6px] bg-black/75 px-1.5 py-0.5 text-[11px] font-semibold text-white tabular-nums">
          {formatDuration(tutorial.durationSeconds)}
        </span>
      </TutorialCover>
      <span className="flex flex-1 flex-col px-4 pt-3 pb-3.5">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-admin-faint">
          {category}
        </span>
        <span className="mt-1 line-clamp-2 text-[14px] leading-snug font-semibold text-admin-primary group-hover:underline">
          {tutorial.title}
        </span>
        {screen && (
          <span className="mt-1 text-[12px] text-admin-muted">
            Ensina a tela {screen}
          </span>
        )}
        {watched && <span className="sr-only">(assistido)</span>}
      </span>
    </Link>
  );
}
