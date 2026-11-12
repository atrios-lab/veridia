"use client";

import { useActionState, useEffect, useId, useState } from "react";
import {
  SIGNED_FORM_CONFIRMATION_FIELD,
  type SignedFormDocument,
} from "@/core/request/attachment.ts";
import {
  SIGNED_FORM_CONFIRMATIONS,
  SIGNED_FORM_WRONG_DOCUMENT_WARNING,
} from "@/core/request/requerimento.ts";
import {
  ATTACHMENT_ACCEPT,
  useAttachmentUpload,
  validateAttachments,
} from "../_lib/attachments.tsx";
import { type AttachState, attachSignedForm } from "../solicitar/actions.ts";
import { Icon } from "./icon.tsx";
import { SignedFormReviewNotice } from "./signed-form-review-notice.tsx";

const LABELS: Record<SignedFormDocument, string> = {
  requerimento: "Anexar requerimento assinado",
  declaracao: "Anexar declaração assinada",
};

/**
 * One signed document going back to the office, in two gestures: picking the
 * file shows its name and asks the citizen to confirm it is the signed
 * document, and only then does "Enviar" send it. A wrong file holds the pedido
 * up, so the confirmation is for that one file: a new file starts it over. A
 * sent file shows as a line the citizen can replace, and the whole thing is
 * authorised by the protocol and key it carries as hidden fields. Every screen
 * that takes a signed document renders it, once per document the pedido has:
 * the requerimento always, the declaração de hipossuficiência when there is
 * one (see `attachSignedForm`).
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
  /** Told once per send that was taken, for the screen around it to update
   * whatever it says about the document being awaited: "success" (accepted)
   * or "review" (waits for the office's check). */
  onSent?: (outcome: "success" | "review") => void;
}) {
  const [state, action, saving] = useActionState<AttachState, FormData>(
    attachSignedForm,
    { status: "idle" },
  );
  const { send, uploading, error, setError } = useAttachmentUpload(action);
  const sending = saving || uploading;
  // Lets someone who sent the wrong file try again: opens the upload form
  // back up even after a success, and closes it once a new upload lands.
  const [replacing, setReplacing] = useState(false);
  const [pickedName, setPickedName] = useState<string>();
  const [confirmed, setConfirmed] = useState(false);
  const inputId = useId();
  const sent = state.status === "success" || state.status === "review";
  const showForm = !sent || replacing;
  // The requerimento is read before it is taken (decision of 12/11/2026).
  const checking = documento === "requerimento";

  // biome-ignore lint/correctness/useExhaustiveDependencies: runs per send (a new `state` object), not per parent render; listing `onSent` would re-announce the same send whenever the parent re-renders with a fresh closure.
  useEffect(() => {
    if (state.status === "success" || state.status === "review") {
      setReplacing(false);
      setPickedName(undefined);
      setConfirmed(false);
      onSent?.(state.status);
    }
  }, [state]);

  function handlePick(input: HTMLInputElement) {
    const file = input.files?.[0];
    setConfirmed(false);
    const problem = file && validateAttachments([file], 1);
    if (problem) input.value = "";
    setError(problem);
    setPickedName(problem ? undefined : file?.name);
  }

  if (!showForm && state.status === "review") {
    return (
      <SignedFormReviewNotice
        protocolNumber={protocolNumber}
        accessKey={accessKey}
        onReplace={() => setReplacing(true)}
      />
    );
  }

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
      {/* Kept mounted through both gestures, because it is what holds the
          file; the dashed box and "Trocar" are labels for it. Hidden but
          working for keyboard and screen reader. Named by document, so a
          screen with both uploads has two inputs a test (or a script) can
          tell apart; the action reads the field the hidden `documento` names. */}
      <input
        id={inputId}
        type="file"
        name={documento}
        accept={ATTACHMENT_ACCEPT}
        className="peer sr-only"
        disabled={sending}
        onChange={(event) => handlePick(event.target)}
      />
      {pickedName === undefined ? (
        <label
          htmlFor={inputId}
          className="flex cursor-pointer items-center justify-center gap-2 rounded-[10px] border-[1.5px] border-dashed border-brand-border px-3 py-2.5 text-[12.5px] font-semibold text-brand-primary hover:border-brand-accent peer-focus-visible:border-brand-accent"
        >
          <Icon name="plus" className="h-3.5 w-3.5 text-brand-accent" />
          {LABELS[documento]}
        </label>
      ) : (
        <div className="flex flex-col gap-2.5 rounded-[10px] border-[1.5px] border-brand-border px-3 py-2.5 peer-focus-visible:border-brand-accent">
          <div className="flex items-center gap-2">
            <Icon
              name="file"
              className="h-3.5 w-3.5 shrink-0 text-brand-accent"
            />
            <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-brand-primary">
              {pickedName}
            </span>
            <label
              htmlFor={inputId}
              className={`btn btn-ghost btn-sm shrink-0 cursor-pointer ${sending ? "pointer-events-none opacity-60" : ""}`}
            >
              Trocar
            </label>
          </div>
          <label className="flex cursor-pointer items-start gap-2 text-[12px] leading-relaxed text-brand-text-soft">
            <input
              type="checkbox"
              name={SIGNED_FORM_CONFIRMATION_FIELD}
              className="mt-0.5 h-4.5 w-4.5 shrink-0 accent-brand-primary"
              checked={confirmed}
              disabled={sending}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            <span>
              {SIGNED_FORM_CONFIRMATIONS[documento]}{" "}
              <strong className="font-semibold text-brand-alert">
                {SIGNED_FORM_WRONG_DOCUMENT_WARNING}
              </strong>
            </span>
          </label>
          <button
            type="submit"
            className="btn btn-primary btn-md self-start"
            disabled={!confirmed || sending}
          >
            {sending
              ? checking
                ? "Verificando o documento..."
                : "Enviando..."
              : "Enviar"}
          </button>
          {sending && checking && (
            <output className="flex items-center gap-2 text-[12px] text-brand-muted">
              <span
                aria-hidden="true"
                className="h-3 w-3 animate-spin rounded-full border-2 border-brand-border border-t-brand-accent"
              />
              Verificando documentos: o sistema confere se é o requerimento
              deste protocolo e se está assinado.
            </output>
          )}
        </div>
      )}
      {(error || state.status === "error") && (
        <output className="mt-2 block text-[12px] font-semibold text-brand-alert">
          {error ?? (state.status === "error" && state.message)}
        </output>
      )}
    </form>
  );
}
