import Link from "next/link";
import type { Tutorial } from "@/core/tutorials/catalog.ts";
import type { TrailProgress } from "@/core/tutorials/progress.ts";

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
    <div className="rounded-[14px] border border-admin-border bg-admin-card p-5">
      <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-admin-faint">
        Primeiros passos
      </span>
      <p className="mt-2.5 text-[13px] font-semibold text-admin-primary">
        {progress.watched} de {progress.total} assistidos
      </p>
      <p className="mt-0.5 text-[12px] text-admin-muted">
        Próximo: {next.title}
      </p>
      <Link
        href={`/admin/ajuda?video=${encodeURIComponent(next.id)}`}
        className="btn btn-admin-secondary btn-sm mt-3"
      >
        Assistir
      </Link>
    </div>
  );
}
