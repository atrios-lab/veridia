"use client";

import Link from "next/link";
import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { DocumentNameField } from "../../../../../_components/document-name-field.tsx";
import {
  type AttachmentItem,
  AttachmentRow,
} from "../../../../_components/attachment-row.tsx";
import { useEmailWarning } from "../../../../_components/use-email-warning.ts";
import {
  type ActionState,
  deleteAttachmentAction,
  deliverDocumentAction,
  renameDeliveredAction,
  signDeliveredAction,
} from "../actions.ts";

export interface DeliveryCertificate {
  id: string;
  label: string;
  holderName: string;
}

/** The same check the server makes (lib/signature/pades.ts hasSignature). */
async function carriesSignature(file: File): Promise<boolean> {
  if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
    return false;
  }
  const text = new TextDecoder("latin1").decode(await file.arrayBuffer());
  return /\/ByteRange\s*\[/.test(text);
}

type Check =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "signed"; name: string }
  | { kind: "unsigned"; name: string; pdf: boolean };

export function DeliverySection({
  requestId,
  delivered,
  unsigned,
  physical,
  certificates,
  canManageCertificates,
  nameSuggestions,
  defaultName,
}: {
  requestId: string;
  delivered: AttachmentItem[];
  /** Names built from the act and the protocol (core/request/delivery-name). */
  nameSuggestions: string[];
  /** What a delivery with no name typed is called. */
  defaultName: string;
  /** Delivered PDFs with no digital signature (see lib/signing.ts). */
  unsigned: string[];
  /** Confirmed as signed by hand and scanned: id to "who, when". */
  physical: Record<string, string>;
  /** The certificates this clerk may sign with. */
  certificates: DeliveryCertificate[];
  canManageCertificates: boolean;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    deliverDocumentAction,
    { status: "idle" },
  );
  useEmailWarning(state);
  const formRef = useRef<HTMLFormElement>(null);
  const choiceRef = useRef<HTMLInputElement>(null);
  const [check, setCheck] = useState<Check>({ kind: "idle" });
  const [confirmed, setConfirmed] = useState(false);

  // Every file for the client is checked before it goes (decision of
  // 11/11/2026): signed digitally, or the clerk decides what to do.
  const inspect = async (file: File) => {
    setConfirmed(false);
    setCheck({ kind: "checking" });
    const signed = await carriesSignature(file).catch(() => false);
    setCheck(
      signed
        ? { kind: "signed", name: file.name }
        : {
            kind: "unsigned",
            name: file.name,
            pdf: file.type === "application/pdf" || /\.pdf$/i.test(file.name),
          },
    );
  };
  const send = (choice: "" | "digital" | "fisica") => {
    if (choiceRef.current) choiceRef.current.value = choice;
    setCheck({ kind: "idle" });
    formRef.current?.requestSubmit();
  };
  const cancel = () => {
    setCheck({ kind: "idle" });
    formRef.current?.reset();
  };

  useEffect(() => {
    if (state.status !== "success") return;
    toast.success(
      "Documento entregue. Já aparece na consulta do cidadão. Confira se ele está assinado digitalmente.",
    );
    // Without this the input keeps the file it just sent, so picking the very
    // same file again fires no change event and nothing happens, silently:
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
            <div key={attachment.id}>
              <AttachmentRow
                requestId={requestId}
                attachment={attachment}
                meta="entregue em"
                onDelete={deleteAttachmentAction}
              />
              {!attachment.goneLabel && (
                <RenameDelivered
                  requestId={requestId}
                  attachmentId={attachment.id}
                  suggestions={nameSuggestions}
                />
              )}
              {physical[attachment.id] && (
                <p className="mt-1 rounded-[8px] bg-admin-input-bg px-2.5 py-1.5 text-[12px] text-admin-muted">
                  📄 Documento físico digitalizado, sem assinatura digital ·
                  confirmado por {physical[attachment.id]}
                </p>
              )}
              {unsigned.includes(attachment.id) && (
                <UnsignedNotice
                  requestId={requestId}
                  attachmentId={attachment.id}
                  certificates={certificates}
                  canManageCertificates={canManageCertificates}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <form action={action} ref={formRef} className="mt-3.5">
        <input type="hidden" name="requestId" value={requestId} />
        <input type="hidden" name="assinatura" ref={choiceRef} />
        <div className="mb-3">
          <DocumentNameField
            field="documento"
            tone="admin"
            suggestions={nameSuggestions}
            placeholder={defaultName}
            hint={`Sem nome, o documento sai como "${defaultName}".`}
          />
        </div>
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
              const file = event.target.files?.[0];
              if (file) void inspect(file);
            }}
          />
        </label>
      </form>
      {check.kind === "checking" && (
        <p className="mt-2 text-[12.5px] text-admin-muted">
          Conferindo a assinatura digital do documento...
        </p>
      )}
      {check.kind === "signed" && (
        <div className="mt-3 rounded-[12px] border border-admin-success-text/30 bg-admin-success-bg px-4 py-3 text-[13px] text-admin-success-text">
          <p className="font-semibold">
            ✓ &quot;{check.name}&quot; tem assinatura digital.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => send("")}
              className="btn btn-admin-primary btn-sm"
            >
              Enviar ao cliente
            </button>
            <button
              type="button"
              onClick={cancel}
              className="btn btn-admin-secondary btn-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
      {check.kind === "unsigned" && (
        <div
          role="alertdialog"
          aria-label="Documento sem assinatura digital"
          className="mt-3 rounded-[12px] border border-admin-warning-soft-border bg-admin-warning-bg px-4 py-3 text-[13px] text-admin-warning-text"
        >
          <p className="font-bold">
            ⚠ O documento anexado não contém assinatura digital.
          </p>
          <p className="mt-0.5">&quot;{check.name}&quot;</p>
          {check.pdf && (
            <>
              <p className="mt-2 font-semibold">
                Deseja assinar o documento digitalmente?
              </p>
              <button
                type="button"
                onClick={() => send("digital")}
                className="btn btn-admin-primary btn-sm mt-1.5"
              >
                Sim, enviar e assinar digitalmente
              </button>
            </>
          )}
          <label className="mt-3 flex items-start gap-2 text-[12.5px]">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              className="checkbox-admin mt-0.5"
            />
            Confirmo que é um documento desmaterializado, apenas com assinatura
            física, que foi digitalizado.
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!confirmed}
              onClick={() => send("fisica")}
              className="btn btn-admin-secondary btn-sm"
            >
              Enviar como documento físico digitalizado
            </button>
            <button
              type="button"
              onClick={cancel}
              className="text-[12.5px] font-semibold underline"
            >
              Cancelar
            </button>
          </div>
          <p className="mt-2 text-[11.5px]">
            A escolha fica registrada na auditoria.
          </p>
        </div>
      )}
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

/**
 * The reminder under a delivered PDF that carries no digital signature, and
 * the way to sign it right there with the office's certificate.
 */
function UnsignedNotice({
  requestId,
  attachmentId,
  certificates,
  canManageCertificates,
}: {
  requestId: string;
  attachmentId: string;
  certificates: DeliveryCertificate[];
  canManageCertificates: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    async (previous, formData) => {
      const result = await signDeliveredAction(previous, formData);
      if (result.status === "success") {
        toast.success(
          "Documento assinado. O cidadão já baixa a versão assinada, com o QR de verificação.",
        );
      }
      return result;
    },
    { status: "idle" },
  );
  const FIELD =
    "w-full rounded-[9px] border border-admin-input-border bg-admin-card px-3 py-2 text-[13px] text-admin-text outline-none focus:border-admin-primary-soft";

  return (
    <div className="mt-1.5 rounded-[10px] border border-admin-warning-text/40 bg-admin-warning-bg px-3 py-2.5 text-[12.5px] text-admin-warning-text">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>
          <strong>Sem assinatura digital.</strong> O cidadão vai baixar este PDF
          sem assinatura. Assine pela plataforma antes de concluir.
        </span>
        {certificates.length > 0 ? (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="btn btn-admin-primary btn-sm shrink-0"
            aria-expanded={open}
          >
            Assinar pela plataforma
          </button>
        ) : canManageCertificates ? (
          <Link
            href="/admin/configuracoes/certificados"
            className="font-semibold underline"
          >
            Cadastrar certificado
          </Link>
        ) : (
          <span>Peça ao administrador um certificado para assinar.</span>
        )}
      </div>
      {open && certificates.length > 0 && (
        <form
          // Not `action={...}`: a wrong password would clear the fields.
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            startTransition(() => action(data));
          }}
          className="mt-2.5 grid grid-cols-1 gap-2.5 text-admin-text md:grid-cols-[1fr_1fr_auto] md:items-end"
        >
          <input type="hidden" name="requestId" value={requestId} />
          <input type="hidden" name="attachmentId" value={attachmentId} />
          <label className="flex flex-col gap-1 text-[12px] font-bold text-admin-primary">
            Certificado
            <select name="certificateId" required className={FIELD}>
              {certificates.map((certificate) => (
                <option key={certificate.id} value={certificate.id}>
                  {certificate.label} · {certificate.holderName}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-bold text-admin-primary">
            Senha do certificado
            <input
              name="password"
              type="password"
              autoComplete="off"
              required
              className={FIELD}
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="btn btn-admin-primary btn-md"
          >
            {pending ? "Assinando..." : "Assinar"}
          </button>
          {state.status === "error" && (
            <p
              role="alert"
              className="font-semibold text-admin-error-text md:col-span-3"
            >
              {state.message}
            </p>
          )}
        </form>
      )}
    </div>
  );
}

/** Gives a delivered document the name the citizen sees, after the fact. */
function RenameDelivered({
  requestId,
  attachmentId,
  suggestions,
}: {
  requestId: string;
  attachmentId: string;
  suggestions: string[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    async (previous, formData) => {
      const result = await renameDeliveredAction(previous, formData);
      if (result.status === "success") {
        toast.success("Nome alterado. O cidadão já vê o novo nome.");
        setOpen(false);
      }
      return result;
    },
    { status: "idle" },
  );
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 ml-1 text-[11.5px] font-semibold text-admin-muted underline hover:text-admin-primary"
      >
        Renomear
      </button>
    );
  }
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => action(data));
      }}
      className="mt-1.5 flex flex-wrap items-end gap-2"
    >
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="attachmentId" value={attachmentId} />
      <div className="min-w-0 flex-1">
        <DocumentNameField
          field="novo"
          tone="admin"
          suggestions={suggestions}
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="btn btn-admin-primary btn-sm"
      >
        {pending ? "Salvando..." : "Salvar nome"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="btn btn-admin-secondary btn-sm"
      >
        Cancelar
      </button>
      {state.status === "error" && (
        <p
          role="alert"
          className="basis-full text-[12px] font-semibold text-admin-error-text"
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
