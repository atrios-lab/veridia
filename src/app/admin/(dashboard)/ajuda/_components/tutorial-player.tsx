"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import type { Tutorial } from "@/core/tutorials/catalog.ts";
import { formatDuration } from "@/core/tutorials/progress.ts";
import {
  markTutorialWatchedAction,
  unmarkTutorialWatchedAction,
} from "../actions.ts";

/**
 * The featured video at the top of Treinamento: the player on the left,
 * on the right a badge with where the person stands on the trail, the
 * title, the description and the watched toggle. Stacked below `lg`.
 *
 * The browser's own player, nothing else: no script, no iframe, no third
 * party inside a registry's panel. The captions ride along as a WebVTT
 * track, on by default, for a counter with the sound off.
 *
 * Reaching the end marks the video watched, once per playback; the button
 * does the same by hand and undoes it. The tick flips right away and rolls
 * back with a toast if the server refuses, so the person never waits on a
 * round trip to see what they just did.
 */
export function TutorialPlayer({
  tutorial,
  watched: initialWatched,
  screenLabel,
  badge,
}: {
  tutorial: Tutorial;
  watched: boolean;
  /** The sidebar label of the screen this video teaches, if any. */
  screenLabel: string | null;
  /** "Comece por aqui", "Continue de onde parou · 2 de 5"… */
  badge: string;
}) {
  const [watched, setWatched] = useState(initialWatched);
  const [pending, startTransition] = useTransition();
  // `ended` fires on every replay; the server ignores repeats, but one
  // request per playback is enough.
  const markedThisPlayback = useRef(false);

  // A different video in the same mounted player (the list swaps the
  // `?video=` param on a client navigation).
  useEffect(() => {
    setWatched(initialWatched);
    markedThisPlayback.current = false;
  }, [initialWatched]);

  function persist(next: boolean) {
    const previous = watched;
    setWatched(next);
    startTransition(async () => {
      const result = next
        ? await markTutorialWatchedAction(tutorial.id)
        : await unmarkTutorialWatchedAction(tutorial.id);
      if (result.status === "error") {
        setWatched(previous);
        toast.error(result.message);
      }
    });
  }

  return (
    <section
      aria-labelledby="tutorial-title"
      className="grid grid-cols-1 overflow-hidden rounded-[16px] border border-admin-border bg-admin-card lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]"
    >
      <div className="bg-black">
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
      </div>

      <div className="flex flex-col justify-center gap-3 p-6 lg:p-8">
        <span className="self-start rounded-full bg-admin-primary px-3 py-1 text-[11.5px] font-bold text-white">
          {badge}
        </span>
        <h2
          id="tutorial-title"
          className="font-serif text-[22px] leading-tight font-semibold text-admin-primary"
        >
          {tutorial.title}
        </h2>
        {tutorial.description && (
          <p className="text-[13.5px] leading-normal text-admin-muted">
            {tutorial.description}
          </p>
        )}
        <p className="text-[12px] text-admin-faint">
          {formatDuration(tutorial.durationSeconds)}
          {screenLabel && ` · ensina a tela ${screenLabel}`}
        </p>
        <div className="pt-1">
          <button
            type="button"
            onClick={() => persist(!watched)}
            disabled={pending}
            aria-pressed={watched}
            className={
              watched
                ? "btn btn-admin-secondary btn-sm"
                : "btn btn-admin-primary btn-sm"
            }
          >
            {watched ? "Assistido · Desfazer" : "Marcar como assistido"}
          </button>
        </div>
      </div>
    </section>
  );
}
