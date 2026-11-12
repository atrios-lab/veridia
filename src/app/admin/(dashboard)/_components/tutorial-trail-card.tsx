import Link from "next/link";
import {
  courseHref,
  PANEL_COURSE_SLUG,
  type Tutorial,
} from "@/core/tutorials/catalog.ts";
import type { TrailProgress } from "@/core/tutorials/progress.ts";
import { buttonVariants } from "../../_ui/button.tsx";
import { cn } from "../../_ui/cn.ts";
import { Progress } from "../../_ui/progress.tsx";

/**
 * "Primeiros passos": how far this person is along the tutorial trail and
 * which video comes next. The page renders it only while there is a next
 * one: a completed trail has nothing to suggest, and the card leaving is
 * the whole reward. Never a gate, only a pointer.
 */
export function TutorialTrailCard({
  progress,
  next,
}: {
  progress: TrailProgress;
  next: Tutorial;
}) {
  return (
    <section className="rounded-xl border bg-card p-6 shadow-xs">
      <h2 className="text-base font-semibold text-foreground">
        Primeiros passos
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {progress.watched} de {progress.total} assistidos
      </p>
      <Progress
        className="mt-3"
        value={progress.watched}
        max={Math.max(progress.total, 1)}
        aria-label={`${progress.watched} de ${progress.total} assistidos`}
      />
      <p className="mt-2 text-sm text-muted-foreground">
        Próximo: {next.title}
      </p>
      <Link
        href={courseHref(PANEL_COURSE_SLUG, next.id)}
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "mt-4",
        )}
      >
        Assistir
      </Link>
    </section>
  );
}
