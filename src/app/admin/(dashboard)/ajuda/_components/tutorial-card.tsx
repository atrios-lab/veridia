import Link from "next/link";
import type { Tutorial } from "@/core/tutorials/catalog.ts";
import { formatDuration } from "@/core/tutorials/progress.ts";
import { AdminIcon } from "../../../_components/icon.tsx";
import { Badge } from "../../../_ui/badge.tsx";
import { cn } from "../../../_ui/cn.ts";
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
  href,
}: {
  tutorial: Tutorial;
  watched: boolean;
  current: boolean;
  /** The sidebar group of the taught screen, or "Painel". */
  category: string;
  /** The sidebar label of the taught screen, if any. */
  screen: string | undefined;
  /** The course page opened at this video. */
  href: string;
}) {
  return (
    <Link
      href={href}
      aria-current={current ? "true" : undefined}
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-xl border bg-card transition-colors duration-120 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        current
          ? "border-primary ring-1 ring-primary"
          : "border-border hover:border-input",
      )}
    >
      <TutorialCover title={tutorial.title} posterUrl={tutorial.posterUrl}>
        {watched && (
          <span
            aria-hidden="true"
            className="absolute top-2.5 right-2.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-success text-success-foreground shadow-sm"
          >
            <AdminIcon name="check" className="h-3.5 w-3.5" strokeWidth={2.4} />
          </span>
        )}
        {current && (
          <Badge className="absolute top-2.5 left-2.5 shadow-sm">
            Assistindo
          </Badge>
        )}
        <span className="absolute right-2.5 bottom-2.5 rounded-md bg-black/75 px-1.5 py-0.5 text-xs font-semibold text-white tabular-nums">
          {formatDuration(tutorial.durationSeconds)}
        </span>
      </TutorialCover>
      <span className="flex flex-1 flex-col px-4 pt-3 pb-3.5">
        <span className="text-xs font-medium text-muted-foreground">
          {category}
        </span>
        <span className="mt-1 line-clamp-2 text-sm leading-snug font-semibold text-foreground group-hover:underline">
          {tutorial.title}
        </span>
        {screen && (
          <span className="mt-1 text-xs text-muted-foreground">
            Ensina a tela {screen}
          </span>
        )}
        {watched && <span className="sr-only">(assistido)</span>}
      </span>
    </Link>
  );
}
