"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const QUEUE_POLL_MS = 5000;

/**
 * Refreshes the server-rendered page on an interval, same discipline as the
 * citizen widget's polling (paused while the tab is not visible, so an
 * attendant with the panel open in a background tab all day is not what
 * keeps the server busy). Used by the atendimento queue and by the Visão
 * geral's "Acontecendo agora" card, both of which want the same live feel.
 */
export function QueuePoller() {
  const router = useRouter();
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, QUEUE_POLL_MS);
    return () => clearInterval(interval);
  }, [router]);
  return null;
}
