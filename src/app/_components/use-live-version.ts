"use client";

import { useEffect, useRef } from "react";

/**
 * Keeps a screen current without the person reloading it. `read` fetches a
 * cheap version stamp (the record's `updatedAt`); when it differs from
 * `current`, `onChange` reloads the real data. Both screens that track a
 * request share this so they share the same discipline:
 *
 * - nothing runs while the tab is hidden, and a tab coming back into view
 *   checks at once instead of waiting out the interval;
 * - a failed read (network, rate limit) backs off by doubling the wait, up
 *   to five times the base, and never reaches the screen: it keeps showing
 *   what it last knew;
 * - `null` from `read` is a definitive "no such record for you" and stops
 *   the polling for good.
 *
 * `read` and `onChange` are held in refs, so callers pass plain closures
 * without memoizing them: the loop restarts only when `current` changes.
 */
export function useLiveVersion(
  read: () => Promise<string | null>,
  current: string | undefined,
  onChange: () => void | Promise<void>,
  intervalMs: number,
): void {
  const readRef = useRef(read);
  const onChangeRef = useRef(onChange);
  readRef.current = read;
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!current) return;
    let cancelled = false;
    let wait = intervalMs;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function tick() {
      timer = undefined;
      if (document.visibilityState === "visible") {
        try {
          const version = await readRef.current();
          if (cancelled) return;
          if (version === null) return;
          wait = intervalMs;
          if (version !== current) await onChangeRef.current();
        } catch {
          wait = Math.min(wait * 2, intervalMs * 5);
        }
      }
      if (!cancelled) timer = setTimeout(tick, wait);
    }

    function onVisible() {
      if (document.visibilityState !== "visible" || !timer) return;
      clearTimeout(timer);
      void tick();
    }

    timer = setTimeout(tick, wait);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [current, intervalMs]);
}
