"use client";

import { type ReactNode, useEffect, useRef } from "react";

/**
 * The panel's modal shell, on a native `<dialog>` opened with `showModal()`.
 *
 * Native and not a positioned div because `showModal()` already gives the top
 * layer, the focus trap, Escape, and an inert background. Those are the four
 * things a hand-rolled overlay has to reimplement, and the focus trap is the
 * one it usually gets wrong: invisible with a mouse, disqualifying with a
 * keyboard.
 *
 * Mounted only while open, so the effect that opens it runs once and the body
 * is fresh each time: no stale form state from the last time it was closed.
 *
 * No dismiss-on-backdrop-click. The two ways out are Escape and the panel's
 * own cancel, both reachable from the keyboard; a stray click beside a dialog
 * asking to delete something should not be one of them.
 */
/**
 * The row of actions at the bottom of a dialog. Styled in `globals.css`.
 *
 * Put cancel first among its children: `showModal()` focuses the first
 * focusable descendant, and on a narrow screen the row reverses so the
 * confirming action still lands on top. The class handles the reversal; the
 * DOM order is the caller's part of the bargain.
 */
export const DIALOG_FOOTER = "dialog-footer";

export function AdminDialog({
  onClose,
  labelledBy,
  children,
}: {
  /** Escape and the panel's own cancel both land here. */
  onClose: () => void;
  /** Id of the heading inside, so the dialog announces what it is asking. */
  labelledBy: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog?.isConnected) return;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      className="dialog"
      // Escape fires `cancel` before `close`; routing both through onClose
      // keeps React's state and the element's own state from drifting apart.
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      {children}
    </dialog>
  );
}
