"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  type AttachmentItem,
  AttachmentRow,
} from "../../../../_components/attachment-row.tsx";
import {
  type ActionState,
  deleteAttachmentAction,
  deliverDocumentAction,
} from "../actions.ts";

export function DeliverySection({
  requestId,
  delivered,
}: {
  requestId: string;
  delivered: AttachmentItem[];
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    deliverDocumentAction,
    { status: "idle" },
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status !== "success") return;
    toast.success("Documento entregue. Já aparece na consulta do cidadão.");
    // Without this the input keeps the file it just sent, so picking the very
    // same file again fires no change event and nothing happens, silently —
    // which is exactly what someone does right after deleting a wrong upload.
    formRef.current?.reset();
  }, [state]);

  return (
    <div className="rounded-[14px] border border-admin-border bg-admin-card p-6">
      <h4 className="font-serif text-[17px] font-semibold text-admin-primary">
        Entrega ao cidadão
      </h4>
      <p className="mt-1 text-[12.5px] text-admin-muted">
        O que você anexar aqui fica disponível na consulta do cidadão.
      </p>

      {/* Choosing the file publishes it, with no review step in between, so
          the row below is what makes that recoverable: it opens the file the
          citizen will get, and takes it back. */}
      {delivered.length > 0 && (
        <div className="mt-3.5 flex flex-col gap-2">
          {delivered.map((attachment) => (
            <AttachmentRow
              key={attachment.id}
              requestId={requestId}
              attachment={attachment}
              meta="entregue em"
              onDelete={deleteAttachmentAction}
            />
          ))}
        </div>
      )}

      <form action={action} ref={formRef} className="mt-3.5">
        <input type="hidden" name="requestId" value={requestId} />
        {/* The file input is visually hidden but still in the tab order, so
            the ring is the only thing telling a keyboard user they are on it. */}
        <label
          className={`relative flex flex-col items-center gap-1 rounded-[11px] border-[1.5px] border-dashed border-admin-input-border px-5 py-5 text-center focus-within:border-admin-accent focus-within:ring-2 focus-within:ring-admin-accent ${pending ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
        >
          <span className="text-[13px] font-bold text-admin-primary">
            {pending
              ? "Enviando…"
              : delivered.length > 0
                ? "Anexar outro documento"
                : "Anexar documento final"}
          </span>
          <span className="text-[12px] text-admin-faint">
            PDF assinado com selo digital
          </span>
          <input
            type="file"
            name="documento"
            accept="application/pdf,image/jpeg,image/png,image/webp,image/heic"
            className="sr-only"
            disabled={pending}
            onChange={(event) => {
              if (event.target.files?.length) {
                event.target.form?.requestSubmit();
              }
            }}
          />
        </label>
      </form>
      {state.status === "error" && (
        <p
          role="alert"
          className="mt-2 text-[12.5px] font-semibold text-admin-error-text"
        >
          {state.message}
        </p>
      )}
    </div>
  );
}
