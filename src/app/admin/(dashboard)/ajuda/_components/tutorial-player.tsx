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
}: {
  tutorial: Tutorial;
  watched: boolean;
  /** The sidebar label of the screen this video teaches, if any. */
  screenLabel: string | null;
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
      className="rounded-[14px] border border-admin-border bg-admin-card p-5"
    >
      <video
        key={tutorial.id}
        controls
        preload="metadata"
        // The captions come from another origin (the Blob store), and a
        // <track> is only read cross-origin under CORS: without this the
        // browser drops the captions in silence. The store answers with
        // `access-control-allow-origin: *`, so anonymous is enough.
        crossOrigin="anonymous"
        className="aspect-video w-full rounded-[10px] bg-black"
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
        <track
          kind="captions"
          src={tutorial.captionsUrl}
          srcLang="pt-BR"
          label="Português"
          default
        />
        Seu navegador não toca este vídeo.
      </video>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2
            id="tutorial-title"
            className="font-serif text-[20px] leading-tight font-semibold text-admin-primary"
          >
            {tutorial.title}
          </h2>
          <p className="mt-1 text-[13.5px] leading-normal text-admin-muted">
            {tutorial.description}
          </p>
          <p className="mt-2 text-[12px] text-admin-faint">
            {formatDuration(tutorial.durationSeconds)}
            {screenLabel && ` · ensina a tela ${screenLabel}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => persist(!watched)}
          disabled={pending}
          aria-pressed={watched}
          className={
            watched
              ? "btn btn-admin-secondary btn-sm flex-none"
              : "btn btn-admin-primary btn-sm flex-none"
          }
        >
          {watched ? "Assistido · Desfazer" : "Marcar como assistido"}
        </button>
      </div>
    </section>
  );
}
