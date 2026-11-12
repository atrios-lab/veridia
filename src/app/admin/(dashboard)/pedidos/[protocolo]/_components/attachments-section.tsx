"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { CITIZEN_DOCUMENT_NAMES } from "@/core/request/delivery-name.ts";
import { DocumentNameField } from "../../../../../_components/document-name-field.tsx";
import {
  type AttachmentItem,
  AttachmentRow,
} from "../../../../_components/attachment-row.tsx";
import {
  NativeSelect,
  NativeSelectOption,
} from "../../../../_ui/native-select.tsx";
import {
  type ActionState,
  attachCitizenDocumentAction,
  deleteAttachmentAction,
} from "../actions.ts";

export function AttachmentsSection({
  requestId,
  attachments,
  hasExemption,
}: {
  requestId: string;
  attachments: AttachmentItem[];
  /** Whether the pedido has a declaração de hipossuficiência to sign: only
   * then can a scanned paper be filed as its signed copy. */
  hasExemption: boolean;
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
    <div className="rounded-xl border bg-card p-6">
      <h4 className="text-base font-semibold text-foreground">
        Documentos anexados pelo cidadão
      </h4>
      {attachments.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Nenhum documento anexado.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
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
      <form action={action} className="mt-4 flex flex-col gap-2">
        <input type="hidden" name="requestId" value={requestId} />
        {/* Which paper is being scanned. A signed requerimento or declaração
            filed here becomes the via assinada the header opens, the same as
            one the citizen sent through the site. */}
        <label
          htmlFor={`como-${requestId}`}
          className="flex items-center gap-2 text-sm text-foreground"
        >
          <span className="shrink-0 font-medium">Este arquivo é</span>
          <NativeSelect
            id={`como-${requestId}`}
            name="como"
            defaultValue="documento"
            disabled={pending}
            className="w-full flex-1"
          >
            <NativeSelectOption value="documento">
              Documento do cidadão
            </NativeSelectOption>
            <NativeSelectOption value="requerimento">
              Requerimento assinado
            </NativeSelectOption>
            {hasExemption && (
              <NativeSelectOption value="declaracao">
                Declaração assinada
              </NativeSelectOption>
            )}
          </NativeSelect>
        </label>
        <DocumentNameField
          field="documento"
          tone="admin"
          suggestions={CITIZEN_DOCUMENT_NAMES}
          hint="Para documento do cidadão. Requerimento e declaração assinados já têm nome."
        />
        <label
          className={`relative flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-input px-3 py-2.5 text-center text-sm font-medium text-primary transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 hover:bg-muted/50 ${pending ? "cursor-not-allowed opacity-60" : ""}`}
        >
          {pending ? "Anexando…" : "Anexar arquivo (balcão)"}
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
