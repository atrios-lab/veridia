"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "../_ui/cn.ts";

/** How tall the fade is, at the edge where more cards are waiting. */
const FADE = "2.5rem";

/**
 * The one place the panel's alerts live (agenda, new records, guias), at
 * the top right, under the top bar. They used to float on their own, from
 * different corners, and a busy morning stacked them on top of each other.
 * Here they share a single column: each group sits below the previous one
 * and the column never grows past the window (it scrolls instead). The chat
 * keeps the bottom right, so the column stops short of it.
 *
 * A column that scrolls has to say so: a card cut in half reads as a broken
 * layout, not as "there is more". So the edge with more cards behind it
 * fades out, and the column shows a thin scrollbar that can be dragged.
 */
export function AlertDock({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ above: false, below: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const above = el.scrollTop > 1;
      const below = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
      setEdges((current) =>
        current.above === above && current.below === below
          ? current
          : { above, below },
      );
    };
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    // Cards come and go with every poll, and the window can be resized.
    const resized = new ResizeObserver(measure);
    resized.observe(el);
    const changed = new MutationObserver(measure);
    changed.observe(el, { childList: true, subtree: true });
    return () => {
      el.removeEventListener("scroll", measure);
      resized.disconnect();
      changed.disconnect();
    };
  }, []);

  const scrolls = edges.above || edges.below;
  const mask = scrolls
    ? `linear-gradient(to bottom, ${edges.above ? "transparent" : "black"}, black ${FADE}, black calc(100% - ${FADE}), ${edges.below ? "transparent" : "black"})`
    : undefined;

  return (
    <div
      ref={ref}
      style={{ maskImage: mask, WebkitMaskImage: mask }}
      className={cn(
        "fixed top-20 right-4 z-40 flex max-h-[max(12rem,calc(100svh-17rem))] w-[min(340px,calc(100vw-2rem))] flex-col gap-2.5 overflow-y-auto overscroll-contain",
        // Only a column that scrolls takes the pointer, so its scrollbar can
        // be dragged; otherwise clicks in the gaps reach the page below.
        scrolls
          ? "pointer-events-auto pr-1 [scrollbar-color:var(--color-sidebar-border)_transparent] [scrollbar-width:thin]"
          : "pointer-events-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
      )}
    >
      {children}
    </div>
  );
}

/**
 * What a group does not show: "Mais 3 avisos" and a way to clear the lot, so
 * ten bookings are one row, not ten cards.
 */
export function AlertOverflow({
  hidden,
  noun,
  onDismissAll,
}: {
  hidden: number;
  /** "agendamentos", "requerimentos": plural, after the number. */
  noun: string;
  onDismissAll: () => void;
}) {
  if (hidden <= 0) return null;
  return (
    <div className="pointer-events-auto flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-2 text-xs text-card-foreground shadow-lg">
      <span className="font-medium">
        Mais {hidden} {noun}
      </span>
      <button
        type="button"
        onClick={onDismissAll}
        className="font-medium text-primary underline"
      >
        Dispensar todos
      </button>
    </div>
  );
}
