"use client";

import { useActionState, useEffect, useState } from "react";
import type { SignedFormDocument } from "@/core/request/attachment.ts";
import {
  ATTACHMENT_ACCEPT,
  useAttachmentUpload,
} from "../_lib/attachments.tsx";
import { type AttachState, attachSignedForm } from "../solicitar/actions.ts";
import { Icon } from "./icon.tsx";

const LABELS: Record<SignedFormDocument, string> = {
  requerimento: "Anexar requerimento assinado",
  declaracao: "Anexar declaração assinada",
};

/**
 * One signed document going back to the office: picking the file is the
 * send (no separate button), a sent file shows as a line the citizen can
 * replace, and the whole thing is authorised by the protocol and key it
 * carries as hidden fields. The success screen and the consult both render
 * it, once per document the pedido has: the requerimento always, the
 * declaração de hipossuficiência when there is one (see `attachSignedForm`).
 */
export function SignedFormUpload({
  protocolNumber,
  accessKey,
  documento,
  onSent,
}: {
  protocolNumber: string;
  accessKey: string;
  documento: SignedFormDocument;
  /** Told once per successful send, for the screen around it to update
   * whatever it says about the document being awaited. */
  onSent?: () => void;
}) {
  const [state, action, saving] = useActionState<AttachState, FormData>(
    attachSignedForm,
    { status: "idle" },
  );
  const { send, uploading, error } = useAttachmentUpload(action);
  const sending = saving || uploading;
  // Lets someone who sent the wrong file try again: opens the upload form
  // back up even after a success, and closes it once a new upload lands.
  const [replacing, setReplacing] = useState(false);
  const showForm = state.status !== "success" || replacing;

  // biome-ignore lint/correctness/useExhaustiveDependencies: runs per send (a new `state` object), not per parent render; listing `onSent` would re-announce the same send whenever the parent re-renders with a fresh closure.
  useEffect(() => {
    if (state.status === "success") {
      setReplacing(false);
      onSent?.();
    }
  }, [state]);

  if (!showForm) {
    return (
      <div className="flex items-center gap-2 rounded-[10px] border-[1.5px] border-brand-border bg-brand-card px-3.5 py-2.5">
        <Icon
          name="check"
          className="h-3.5 w-3.5 shrink-0 text-brand-primary-soft"
          strokeWidth={2.4}
        />
        <output className="flex-1 text-[12px] font-semibold text-brand-primary-soft">
          {state.message}
        </output>
        <button
          type="button"
          onClick={() => setReplacing(true)}
          className="btn btn-ghost btn-sm shrink-0"
        >
          Trocar arquivo
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void send(event.currentTarget, documento, 1);
      }}
    >
      <input type="hidden" name="protocolNumber" value={protocolNumber} />
      <input type="hidden" name="accessKey" value={accessKey} />
      <input type="hidden" name="documento" value={documento} />
      {/* One gesture, like the redesign draws it: picking the file is the
          send. The input is hidden but keeps working for keyboard and screen
          reader; the dashed box is the visible control. */}
      <label
        className={`flex cursor-pointer items-center justify-center gap-2 rounded-[10px] border-[1.5px] border-dashed border-brand-border px-3 py-2.5 text-[12.5px] font-semibold text-brand-primary hover:border-brand-accent has-[:focus-visible]:border-brand-accent ${sending ? "opacity-60" : ""}`}
      >
        <Icon name="plus" className="h-3.5 w-3.5 text-brand-accent" />
        {sending ? "Enviando..." : LABELS[documento]}
        <input
          type="file"
          // Named by document, so a screen with both uploads has two inputs
          // a test (or a script) can tell apart; the action reads the field
          // the hidden `documento` names.
          name={documento}
          accept={ATTACHMENT_ACCEPT}
          className="sr-only"
          disabled={sending}
          onChange={(event) => {
            if (event.target.files?.length) {
              event.target.form?.requestSubmit();
            }
          }}
        />
      </label>
      {(error || state.status === "error") && (
        <output className="mt-2 block text-[12px] font-semibold text-brand-alert">
          {error ?? (state.status === "error" && state.message)}
        </output>
      )}
    </form>
  );
}
