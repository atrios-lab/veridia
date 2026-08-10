"use client";

import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { AdminDialog, DIALOG_FOOTER } from "./dialog.tsx";

/**
 * A destructive action that has to be confirmed in a modal before it fires.
 *
 * A dialog and never `confirm()`: after a few native dialogs the browser
 * offers to block them for the tab, and a blocked `confirm()` returns false
 * forever with no sign, so the most dangerous button in the panel would just
 * stop working, silently, while the operator kept clicking it.
 *
 * The caller keeps its own `useActionState` and passes `pending` and `error`
 * back down, because some of these actions return more than a status (a
 * reissued key, for one). This owns the modal, not the action.
 */
export function ConfirmAction({
  action,
  pending,
  error,
  trigger,
  question,
  consequence,
  confirmLabel,
  pendingLabel,
  children,
  className,
}: {
  /** The dispatch from the caller's `useActionState`. */
  action: (formData: FormData) => void;
  pending: boolean;
  /** The action's error message, or null. Keeps the dialog open when set. */
  error?: string | null;
  /** The closed button, on the page. */
  trigger: string;
  /** The dialog's heading, as a question: "Excluir este protocolo?" */
  question: string;
  /** What happens after, in the operator's words. */
  consequence: string;
  confirmLabel: string;
  pendingLabel: string;
  /** Hidden inputs the action needs. */
  children?: ReactNode;
  /** Layout classes for the trigger. */
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  // False until this opening of the dialog has actually sent something. The
  // caller's `useActionState` outlives the dialog, so without this the error
  // from a previous attempt would be on screen the instant it reopens, about
  // an attempt the operator already dismissed.
  const [sent, setSent] = useState(false);
  const sawPending = useRef(false);
  const questionId = useId();
  const consequenceId = useId();

  // Closes once the action lands, and only then: an error keeps the dialog up,
  // because the message belongs where the operator is looking, and a modal in
  // the top layer covers any toast that tried to say it elsewhere.
  //
  // Gated on having seen `pending` go true and back: closing on "not pending"
  // alone would shut the dialog in the render between the submit and the start
  // of the action, taking any error the action was about to report with it.
  useEffect(() => {
    if (pending) {
      sawPending.current = true;
      return;
    }
    if (!sent || !sawPending.current) return;
    sawPending.current = false;
    if (!error) setOpen(false);
  }, [sent, pending, error]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setSent(false);
          setOpen(true);
        }}
        className={`btn btn-admin-danger btn-sm ${className ?? ""}`}
      >
        {trigger}
      </button>
      {open && (
        <AdminDialog
          labelledBy={questionId}
          onClose={() => {
            if (!pending) setOpen(false);
          }}
        >
          <div className="dialog-body">
            <h2
              id={questionId}
              className="font-serif text-[18px] font-semibold text-admin-primary"
            >
              {question}
            </h2>
            <p
              id={consequenceId}
              className="mt-2 text-[13px] leading-relaxed text-admin-muted"
            >
              {consequence}
            </p>
            {sent && error && (
              <p
                role="alert"
                className="mt-3 text-[12.5px] font-semibold text-admin-error-text"
              >
                {error}
              </p>
            )}
          </div>
          <form
            action={action}
            onSubmit={() => setSent(true)}
            className={DIALOG_FOOTER}
          >
            {children}
            {/* First in the DOM on purpose: `showModal()` focuses the first
                focusable descendant, so the safe button is the one holding
                focus, not the destructive one. The dialog traps focus either
                way, so nothing is out of reach, but the key that opens a
                confirmation should never be the key that completes it.
                `flex-col-reverse` on a narrow screen keeps that DOM order
                while putting the action where a thumb expects it. */}
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={pending}
              className="btn btn-admin-secondary btn-md"
            >
              Voltar
            </button>
            <button
              type="submit"
              aria-describedby={consequenceId}
              disabled={pending}
              className="btn btn-admin-danger-solid btn-md"
            >
              {pending ? pendingLabel : confirmLabel}
            </button>
          </form>
        </AdminDialog>
      )}
    </>
  );
}
