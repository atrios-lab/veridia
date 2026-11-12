"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import type { Tutorial } from "@/core/tutorials/catalog.ts";
import { formatDuration } from "@/core/tutorials/progress.ts";
import { Badge } from "../../../_ui/badge.tsx";
import { Button, buttonVariants } from "../../../_ui/button.tsx";
import {
  markTutorialWatchedAction,
  unmarkTutorialWatchedAction,
} from "../actions.ts";
import { TutorialDescription } from "./tutorial-description.tsx";

/**
 * The video being watched on a course page.
 *
 * In a reference course ("Uso do painel") it is the featured block: the
 * player on the left, on the right a badge with where the person stands on
 * the trail, the title, the description and the watched toggle, stacked
 * below `lg`. Reaching the end marks the video watched; the button does the
 * same by hand and undoes it.
 *
 * In a sequential course (`sequential`) the player stands above the title,
 * next to the course's list, and a video counts only by being watched: no
 * toggle, and until it has been watched once the bar does not jump past the
 * farthest point already played (back is always free). Once it ends,
 * "Próxima aula" leads on. The bar is a speed bump in the browser, not a
 * proof; the course's assessment is what measures.
 *
 * The browser's own player, nothing else: no script, no iframe, no third
 * party inside a registry's panel. The captions ride along as a WebVTT
 * track, on by default, for a counter with the sound off. The tick flips
 * right away and rolls back with a toast if the server refuses.
 */
export function TutorialPlayer({
  tutorial,
  watched: initialWatched,
  screenLabel,
  badge,
  sequential = false,
  label,
  next,
}: {
  tutorial: Tutorial;
  watched: boolean;
  /** The sidebar label of the screen this video teaches, if any. */
  screenLabel: string | null;
  /** "Comece por aqui", "Continue de onde parou · 2 de 5"… */
  badge?: string;
  /** A sequential course's video: counted only by watching it. */
  sequential?: boolean;
  /** "Aula 2 de 12", "Apresentação"…, over the title. */
  label?: string;
  /** Where "Próxima aula" leads once this one is watched. */
  next?: { href: string; label: string } | null;
}) {
  const [watched, setWatched] = useState(initialWatched);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  // `ended` fires on every replay; the server ignores repeats, but one
  // request per playback is enough.
  const markedThisPlayback = useRef(false);
  // The farthest second played so far, for the no-skipping rule.
  const maxReached = useRef(0);

  // A different video in the same mounted player (the list swaps the
  // `?video=` param on a client navigation).
  // biome-ignore lint/correctness/useExhaustiveDependencies: the id is the signal that the video changed.
  useEffect(() => {
    setWatched(initialWatched);
    markedThisPlayback.current = false;
    maxReached.current = 0;
  }, [initialWatched, tutorial.id]);

  function persist(nextWatched: boolean) {
    const previous = watched;
    setWatched(nextWatched);
    startTransition(async () => {
      const result = nextWatched
        ? await markTutorialWatchedAction(tutorial.id)
        : await unmarkTutorialWatchedAction(tutorial.id);
      if (result.status === "error") {
        setWatched(previous);
        toast.error(result.message);
      } else if (sequential) {
        // The list beside the player opens the next lesson: redraw it.
        router.refresh();
      }
    });
  }

  const holdsPosition = sequential && !watched;

  const player = (
    <>
      {/* biome-ignore lint/a11y/useMediaCaption: the <track> renders whenever the video has captions; a video without them is the platform's own call, flagged "Sem legenda" where it is managed. */}
      <video
        key={tutorial.id}
        controls
        preload="metadata"
        poster={tutorial.posterUrl ?? undefined}
        // The captions come from another origin (the Blob store), and a
        // <track> is only read cross-origin under CORS: without this the
        // browser drops the captions in silence. The store answers with
        // `access-control-allow-origin: *`, so anonymous is enough.
        crossOrigin="anonymous"
        className="block aspect-video h-full w-full bg-black object-contain"
        onPlay={() => {
          markedThisPlayback.current = false;
        }}
        onTimeUpdate={(event) => {
          const time = event.currentTarget.currentTime;
          if (!event.currentTarget.seeking && time > maxReached.current) {
            maxReached.current = time;
          }
        }}
        onSeeking={(event) => {
          if (!holdsPosition) return;
          const video = event.currentTarget;
          // A second of slack: the time update lags the playhead.
          if (video.currentTime > maxReached.current + 1) {
            video.currentTime = maxReached.current;
          }
        }}
        onEnded={() => {
          if (markedThisPlayback.current || watched) return;
          markedThisPlayback.current = true;
          persist(true);
        }}
      >
        <source src={tutorial.videoUrl} type="video/mp4" />
        {tutorial.captionsUrl && (
          <track
            kind="captions"
            src={tutorial.captionsUrl}
            srcLang="pt-BR"
            label="Português"
            default
          />
        )}
        Seu navegador não toca este vídeo.
      </video>
    </>
  );

  if (sequential) {
    return (
      <section
        aria-labelledby="tutorial-title"
        className="overflow-hidden rounded-xl border bg-card"
      >
        <div className="bg-black">{player}</div>
        <div className="flex flex-col gap-2.5 p-6">
          {label && (
            <span className="text-xs font-medium text-muted-foreground">
              {label}
            </span>
          )}
          <h2
            id="tutorial-title"
            className="text-xl leading-tight font-semibold text-foreground"
          >
            {tutorial.title}
          </h2>
          {tutorial.description && (
            <TutorialDescription text={tutorial.description} />
          )}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <span className="text-xs text-muted-foreground">
              {formatDuration(tutorial.durationSeconds)}
              {watched
                ? " · assistido"
                : " · conta como assistido ao chegar ao fim"}
            </span>
            {watched && next && (
              <Link href={next.href} className={buttonVariants({ size: "sm" })}>
                {next.label} →
              </Link>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="tutorial-title"
      className="grid grid-cols-1 overflow-hidden rounded-xl border bg-card lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]"
    >
      <div className="bg-black">{player}</div>

      <div className="flex flex-col justify-center gap-3 p-6 lg:p-8">
        {badge && <Badge className="self-start">{badge}</Badge>}
        <h2
          id="tutorial-title"
          className="text-xl leading-tight font-semibold text-foreground"
        >
          {tutorial.title}
        </h2>
        {tutorial.description && (
          <TutorialDescription text={tutorial.description} />
        )}
        <p className="text-xs text-muted-foreground">
          {formatDuration(tutorial.durationSeconds)}
          {screenLabel && ` · ensina a tela ${screenLabel}`}
        </p>
        <div className="pt-1">
          <Button
            type="button"
            size="sm"
            variant={watched ? "outline" : "default"}
            onClick={() => persist(!watched)}
            disabled={pending}
            aria-pressed={watched}
          >
            {watched ? "Assistido · Desfazer" : "Marcar como assistido"}
          </Button>
        </div>
      </div>
    </section>
  );
}
