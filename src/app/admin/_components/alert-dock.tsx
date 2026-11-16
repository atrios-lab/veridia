import type { ReactNode } from "react";

/**
 * The one place the panel's alerts live (agenda, new records, guias), at
 * the top right, under the top bar. They used to float on their own, from
 * different corners, and a busy morning stacked them on top of each other.
 * Here they share a single column: each group sits below the previous one
 * and the column never grows past the window (it scrolls instead). The chat
 * keeps the bottom right, so the column stops short of it.
 */
export function AlertDock({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none fixed top-20 right-4 z-40 flex max-h-[max(12rem,calc(100svh-17rem))] w-[min(340px,calc(100vw-2rem))] flex-col gap-2.5 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
