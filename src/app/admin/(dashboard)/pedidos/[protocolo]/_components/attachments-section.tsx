"use client";

import {
  type AttachmentItem,
  AttachmentRow,
} from "../../../../_components/attachment-row.tsx";
import { deleteAttachmentAction } from "../actions.ts";

export function AttachmentsSection({
  requestId,
  attachments,
}: {
  requestId: string;
  attachments: AttachmentItem[];
}) {
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
    </div>
  );
}
