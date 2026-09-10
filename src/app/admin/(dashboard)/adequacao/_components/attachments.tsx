"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { toast } from "sonner";
import { ATTACHMENT_KINDS, SECTIONS } from "@/core/compliance/sections.ts";
import type { IntakeAttachment } from "@/lib/compliance.ts";
import { ConfirmAction } from "../../../_components/confirm-action.tsx";
import { AdminIcon } from "../../../_components/icon.tsx";
import {
  type AttachmentState,
  completeSectionAction,
  deleteAttachmentAction,
  uploadAttachmentsAction,
} from "../actions.ts";

const SELECT =
  "w-full rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3.5 py-2.5 text-[13.5px] text-admin-text outline-none focus:border-admin-primary-soft";

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Seção 16. The only section with no field: files go straight to the
 * intake, through the same store and the same type and size limits every
 * other attachment in the panel obeys.
 */
export function Attachments({
  attachments,
}: {
  attachments: IntakeAttachment[];
}) {
  const section = SECTIONS.at(-1);
  const previous = SECTIONS.at(-2);
  const [state, formAction, pending] = useActionState<
    AttachmentState,
    FormData
  >(
    async (previousState, formData) => {
      const result = await uploadAttachmentsAction(previousState, formData);
      if (result.status === "success") toast.success("Arquivo anexado.");
      return result;
    },
    { status: "idle" },
  );
  const [chosen, setChosen] = useState(0);

  return (
    <div className="rounded-[14px] border border-admin-border bg-admin-card p-6">
      <h2 className="font-serif text-[17px] font-semibold text-admin-primary">
        {section?.question}
      </h2>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-admin-muted">
        {section?.intro}
      </p>

      <form
        action={formAction}
        className="mt-5 grid grid-cols-1 gap-3.5 rounded-[10px] border border-admin-border bg-admin-input-bg p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      >
        <div>
          <label
            htmlFor="kind"
            className="mb-1.5 block text-xs font-bold text-admin-primary"
          >
            O que é
          </label>
          <select id="kind" name="kind" className={SELECT}>
            {ATTACHMENT_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="arquivo"
            className="mb-1.5 block text-xs font-bold text-admin-primary"
          >
            Arquivos (foto ou PDF, até 20 MB cada)
          </label>
          <input
            id="arquivo"
            name="arquivo"
            type="file"
            multiple
            accept="image/*,application/pdf"
            onChange={(e) => setChosen(e.target.files?.length ?? 0)}
            className="block w-full text-[13px] text-admin-text file:mr-3 file:rounded-[8px] file:border file:border-admin-input-border file:bg-admin-card file:px-3 file:py-1.5 file:text-[12px] file:font-semibold file:text-admin-primary"
          />
        </div>
        <button
          type="submit"
          disabled={pending || chosen === 0}
          className="btn btn-admin-primary btn-md"
        >
          {pending ? "Enviando…" : "Anexar"}
        </button>
        {state.status === "error" && (
          <p
            role="alert"
            className="rounded-lg bg-admin-error-bg px-3.5 py-2.5 text-sm font-semibold text-admin-error-text sm:col-span-3"
          >
            {state.message}
          </p>
        )}
      </form>

      <div className="mt-5 flex flex-col gap-2.5">
        {attachments.length === 0 && (
          <p className="text-[12.5px] text-admin-faint">
            Nenhum arquivo anexado. Tudo bem: os anexos são opcionais.
          </p>
        )}
        {attachments.map((file) => (
          <div
            key={file.id}
            className="flex items-center gap-3 rounded-[10px] border border-admin-border bg-admin-input-bg px-3 py-2.5"
          >
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[7px] bg-admin-readonly-bg text-admin-muted">
              <AdminIcon name="file" className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold text-admin-text">
                {file.displayName}
              </span>
              <span className="block text-[11px] text-admin-muted">
                {formatFileSize(file.sizeBytes)}
              </span>
            </span>
            <a
              href={`/admin/adequacao/anexo?id=${file.id}`}
              target="_blank"
              rel="noopener"
              className="btn btn-admin-secondary btn-sm shrink-0"
            >
              Ver
            </a>
            <DeleteButton attachment={file} />
          </div>
        ))}
      </div>

      <form
        action={completeSectionAction}
        className="mt-6 flex flex-col gap-3 border-t border-admin-border pt-4.5 sm:flex-row sm:items-center sm:justify-between"
      >
        <input type="hidden" name="sectionId" value="anexos" />
        {previous && (
          <Link
            href={`/admin/adequacao/${previous.id}`}
            // Same size as "Revisar e enviar" on the other end of this row.
            className="btn btn-admin-secondary btn-md"
          >
            ‹ Seção {previous.number} · {previous.title}
          </Link>
        )}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href="/admin/adequacao"
            className="btn btn-admin-secondary btn-md"
          >
            Voltar à lista
          </Link>
          <button type="submit" className="btn btn-admin-primary btn-md">
            Revisar e enviar ›
          </button>
        </div>
      </form>
    </div>
  );
}

function DeleteButton({ attachment }: { attachment: IntakeAttachment }) {
  const [state, formAction, pending] = useActionState<
    AttachmentState,
    FormData
  >(
    async (previous, formData) => {
      const result = await deleteAttachmentAction(previous, formData);
      if (result.status === "success") toast.success("Arquivo excluído.");
      return result;
    },
    { status: "idle" },
  );
  return (
    <ConfirmAction
      action={formAction}
      pending={pending}
      error={state.status === "error" ? state.message : null}
      trigger="Excluir"
      question="Excluir este arquivo?"
      consequence={`"${attachment.displayName}" sai do módulo e a Átrios deixa de vê-lo. Não dá para desfazer.`}
      confirmLabel="Confirmar exclusão"
      pendingLabel="Excluindo…"
      className="shrink-0"
    >
      <input type="hidden" name="attachmentId" value={attachment.id} />
    </ConfirmAction>
  );
}
