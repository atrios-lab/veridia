"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import {
  type AttachmentItem,
  AttachmentRow,
} from "../../../../_components/attachment-row.tsx";
import {
  type ActionState,
  attachCitizenDocumentAction,
  deleteAttachmentAction,
} from "../actions.ts";

export function AttachmentsSection({
  requestId,
  attachments,
}: {
  requestId: string;
  attachments: AttachmentItem[];
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    attachCitizenDocumentAction,
    { status: "idle" },
  );

  useEffect(() => {
    if (state.status === "success") toast.success("Documento anexado.");
    if (state.status === "error") toast.error(state.message);
  }, [state]);

  return (
    <div className="rounded-[14px] border border-admin-border bg-admin-card p-6">
      <h4 className="font-serif text-[17px] font-semibold text-admin-primary">
        Documentos anexados pelo cidadão
      </h4>
      {attachments.length === 0 ? (
        <p className="mt-2 text-[12.5px] text-admin-muted">
          Nenhum documento anexado.
        </p>
      ) : (
        <div className="mt-3.5 flex flex-col gap-2">
          {attachments.map((attachment) => (
            <AttachmentRow
              key={attachment.id}
              requestId={requestId}
              attachment={attachment}
              meta="enviado em"
              onDelete={deleteAttachmentAction}
            />
          ))}
        </div>
      )}

      {/* The counter case: the citizen arrives with the paper in hand, and
          whoever is serving them scans it. It lands in this same list, because
          it is the citizen's document however it got here. */}
      <form action={action} className="mt-3.5">
        <input type="hidden" name="requestId" value={requestId} />
        <label
          className={`relative flex cursor-pointer items-center justify-center gap-2 rounded-[9px] border-[1.5px] border-dashed border-admin-input-border px-3 py-2.5 text-center text-[12px] font-semibold text-admin-primary focus-within:border-admin-accent focus-within:ring-2 focus-within:ring-admin-accent ${pending ? "cursor-not-allowed opacity-60" : ""}`}
        >
          {pending ? "Anexando…" : "Anexar documento do cidadão (balcão)"}
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
    </div>
  );
}
