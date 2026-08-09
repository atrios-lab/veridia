"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useGlobalSearch } from "./global-search.tsx";

/** How long a "G" keeps a chord open, waiting for its second key. */
const CHORD_WINDOW_MS = 1000;

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

/**
 * The panel's keyboard shortcuts: Ctrl/Cmd K opens the global search from
 * anywhere, G then P or G then A jump to Pedidos or Agenda, N jumps to
 * lançar um pedido no balcão. Mounted once in the dashboard layout, so it
 * listens on every admin screen the same way.
 *
 * `canRequests`/`canChannels` come from the server: the same permission
 * check that decides what the sidebar offers decides what these shortcuts
 * are allowed to jump to; the destination route still checks for itself.
 */
export function ShortcutListener({
  canRequests,
  canChannels,
}: {
  canRequests: boolean;
  canChannels: boolean;
}) {
  const router = useRouter();
  const { open, isOpen } = useGlobalSearch();
  const chordStartedAt = useRef(0);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const isSearchChord =
        (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (isSearchChord) {
        event.preventDefault();
        open();
        return;
      }

      if (
        isOpen ||
        isEditableTarget(event.target) ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return;
      }

      const key = event.key.toLowerCase();
      const chordOpen = Date.now() - chordStartedAt.current < CHORD_WINDOW_MS;

      if (chordOpen && key === "p") {
        chordStartedAt.current = 0;
        if (canRequests) router.push("/admin/pedidos");
        return;
      }
      if (chordOpen && key === "a") {
        chordStartedAt.current = 0;
        if (canChannels) router.push("/admin/agenda");
        return;
      }
      if (key === "g") {
        chordStartedAt.current = Date.now();
        return;
      }
      if (key === "n") {
        if (canRequests) router.push("/admin/pedidos/novo");
        return;
      }
      chordStartedAt.current = 0;
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [router, open, isOpen, canRequests, canChannels]);

  return null;
}
