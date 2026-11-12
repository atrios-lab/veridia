"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { toast } from "sonner";
import { ATTACHMENT_KINDS, SECTIONS } from "@/core/compliance/sections.ts";
import type { IntakeAttachment } from "@/lib/compliance.ts";
import { ConfirmAction } from "../../../_components/confirm-action.tsx";
import { AdminIcon } from "../../../_components/icon.tsx";
import { Button, buttonVariants } from "../../../_ui/button.tsx";
import { Label } from "../../../_ui/label.tsx";
import {
  NativeSelect,
  NativeSelectOption,
} from "../../../_ui/native-select.tsx";
import {
  type AttachmentState,
  completeSectionAction,
  deleteAttachmentAction,
  uploadAttachmentsAction,
} from "../actions.ts";

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
    <div className="rounded-xl border border-border bg-card p-6">
      <h2 className="text-lg font-semibold text-foreground">
        {section?.question}
      </h2>
      <p className="mt-1.5 text-sm text-muted-foreground">{section?.intro}</p>

      <form
        action={formAction}
        className="mt-6 grid grid-cols-1 gap-4 rounded-lg bg-muted/50 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      >
        <div>
          <Label htmlFor="kind" className="mb-1.5">
            O que é
          </Label>
          <NativeSelect
            id="kind"
            name="kind"
            className="w-full rounded-md bg-background"
          >
            {ATTACHMENT_KINDS.map((k) => (
              <NativeSelectOption key={k.value} value={k.value}>
                {k.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div>
          <Label htmlFor="arquivo" className="mb-1.5">
            Arquivos (foto ou PDF, até 20 MB cada)
          </Label>
          <input
            id="arquivo"
            name="arquivo"
            type="file"
            multiple
            accept="image/*,application/pdf"
            onChange={(e) => setChosen(e.target.files?.length ?? 0)}
            className="block w-full text-sm text-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-foreground"
          />
        </div>
        <Button type="submit" disabled={pending || chosen === 0}>
          {pending ? "Enviando…" : "Anexar"}
        </Button>
        {state.status === "error" && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive-soft px-3.5 py-2.5 text-sm font-medium text-destructive sm:col-span-3"
          >
            {state.message}
          </p>
        )}
      </form>

      <div className="mt-6 flex flex-col divide-y divide-border">
        {attachments.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhum arquivo anexado. Tudo bem: os anexos são opcionais.
          </p>
        )}
        {attachments.map((file) => (
          <div key={file.id} className="flex items-center gap-3 py-3">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <AdminIcon name="file" className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground">
                {file.displayName}
              </span>
              <span className="block text-xs text-muted-foreground">
                {formatFileSize(file.sizeBytes)}
              </span>
            </span>
            <a
              href={`/admin/adequacao/anexo?id=${file.id}`}
              target="_blank"
              rel="noopener"
              className={buttonVariants({
                variant: "outline",
                size: "sm",
                className: "shrink-0",
              })}
            >
              Ver
            </a>
            <DeleteButton attachment={file} />
          </div>
        ))}
      </div>

      <form
        action={completeSectionAction}
        className="mt-6 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between"
      >
        <input type="hidden" name="sectionId" value="anexos" />
        {previous && (
          <Link
            href={`/admin/adequacao/${previous.id}`}
            // Same size as "Revisar e enviar" on the other end of this row.
            className={buttonVariants({ variant: "outline" })}
          >
            ‹ Seção {previous.number} · {previous.title}
          </Link>
        )}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href="/admin/adequacao"
            className={buttonVariants({ variant: "outline" })}
          >
            Voltar à lista
          </Link>
          <Button type="submit">Revisar e enviar ›</Button>
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
