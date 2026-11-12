"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { DocumentNameField } from "../../../../../_components/document-name-field.tsx";
import { documentHref } from "../../../../_components/attachment-link.ts";
import {
  type AttachmentItem,
  AttachmentRow,
} from "../../../../_components/attachment-row.tsx";
import { useEmailWarning } from "../../../../_components/use-email-warning.ts";
import { Button } from "../../../../_ui/button.tsx";
import { Input } from "../../../../_ui/input.tsx";
import {
  NativeSelect,
  NativeSelectOption,
} from "../../../../_ui/native-select.tsx";
import {
  certificateFields,
  LocalSignerPicker,
  useLocalSigner,
} from "../../../utilitarios/assinador/a3.tsx";
import {
  type Mode,
  ModeChoice,
  signThroughToken,
} from "../../../utilitarios/assinador/sign-forms.tsx";
import {
  type ActionState,
  deleteAttachmentAction,
  deliverDocumentAction,
  finishA3DeliveryAction,
  prepareA3DeliveryAction,
  releaseUnsignedAction,
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
  held,
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
  /** Held back until signed here: the citizen does not see them yet. */
  held: string[];
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
  const send = (choice: "" | "digital" | "fisica" | "sem") => {
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
      state.held
        ? "Documento anexado e retido. Assine logo abaixo: o cidadão só vê depois de assinado."
        : "Documento entregue. Já aparece na consulta do cidadão.",
    );
    // Without this the input keeps the file it just sent, so picking the very
    // same file again fires no change event and nothing happens, silently:
    // which is exactly what someone does right after deleting a wrong upload.
    formRef.current?.reset();
  }, [state]);

  return (
    <div className="rounded-xl border bg-card p-6">
      <h4 className="text-base font-semibold text-foreground">
        Entrega ao cidadão
      </h4>
      <p className="mt-1 text-sm text-muted-foreground">
        O que você anexar aqui fica disponível na consulta do cidadão. Um PDF
        sem assinatura digital fica retido até ser assinado aqui.
      </p>

      {/* Choosing the file publishes it, with no review step in between, so
          the row below is what makes that recoverable: it opens the file the
          citizen will get, and takes it back. */}
      {delivered.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          {delivered.map((attachment) => (
            <div key={attachment.id}>
              <AttachmentRow
                requestId={requestId}
                attachment={attachment}
                meta={
                  held.includes(attachment.id) ? "anexado em" : "entregue em"
                }
                onDelete={deleteAttachmentAction}
              />
              {!attachment.goneLabel && (
                <a
                  href={documentHref(requestId, attachment.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="mr-3 inline-block text-xs font-medium text-primary underline underline-offset-4"
                  title="Abre o documento para imprimir: assinado digitalmente (com o QR) ou físico digitalizado"
                >
                  Imprimir
                </a>
              )}
              {!attachment.goneLabel && (
                <RenameDelivered
                  requestId={requestId}
                  attachmentId={attachment.id}
                  suggestions={nameSuggestions}
                />
              )}
              {physical[attachment.id] && (
                <p className="mt-1 rounded-md bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
                  📄 Documento físico digitalizado, sem assinatura digital ·
                  confirmado por {physical[attachment.id]}
                </p>
              )}
              {unsigned.includes(attachment.id) && (
                <UnsignedNotice
                  requestId={requestId}
                  attachmentId={attachment.id}
                  held={held.includes(attachment.id)}
                  certificates={certificates}
                  canManageCertificates={canManageCertificates}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <form action={action} ref={formRef} className="mt-4">
        <input type="hidden" name="requestId" value={requestId} />
        <input type="hidden" name="assinatura" ref={choiceRef} />
        {/* The file input is visually hidden but still in the tab order, so
            the ring is the only thing telling a keyboard user they are on it. */}
        <label
          className={`relative flex flex-col items-center gap-1 rounded-lg border border-dashed border-input px-5 py-5 text-center transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 hover:bg-muted/50 ${pending ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
        >
          <span className="text-sm font-medium text-primary">
            {pending
              ? "Enviando…"
              : delivered.length > 0
                ? "Anexar outro documento"
                : "Anexar documento final"}
          </span>
          <span className="text-xs text-muted-foreground">
            Escolha o arquivo: em seguida você dá o nome e confere a assinatura
            digital, antes de enviar.
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
        {check.kind === "checking" && (
          <p className="mt-2 text-sm text-muted-foreground">
            Conferindo a assinatura digital do documento...
          </p>
        )}
        {check.kind === "signed" && (
          <div className="mt-3 rounded-lg border border-success/30 bg-success-soft p-4 text-sm text-success-text">
            <p className="font-semibold">
              ✓ &quot;{check.name}&quot; tem assinatura digital.
            </p>
            <div className="mt-2 mb-1 text-foreground">
              <DocumentNameField
                field="documento"
                tone="admin"
                suggestions={nameSuggestions}
                placeholder={defaultName}
                hint={`Como o cidadão vai ver o arquivo. Sem nome, sai como "${defaultName}".`}
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={() => send("")}>
                Enviar ao cliente
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={cancel}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
        {check.kind === "unsigned" && (
          <div
            role="alertdialog"
            aria-label="Documento sem assinatura digital"
            className="mt-3 rounded-lg border border-warning/30 bg-warning-soft p-4 text-sm text-warning-text"
          >
            <p className="font-semibold">
              ⚠ O documento anexado não contém assinatura digital.
            </p>
            <p className="mt-0.5">&quot;{check.name}&quot;</p>
            <div className="text-foreground">
              <div className="mt-2 mb-1">
                <DocumentNameField
                  field="documento"
                  tone="admin"
                  suggestions={nameSuggestions}
                  placeholder={defaultName}
                  hint={`Como o cidadão vai ver o arquivo. Sem nome, sai como "${defaultName}".`}
                />
              </div>
            </div>
            {check.pdf && (
              <>
                <p className="mt-2 font-semibold">
                  Deseja assinar o documento digitalmente?
                </p>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => send("digital")}
                  className="mt-1.5"
                >
                  Sim, assinar antes de enviar
                </Button>
                <p className="mt-1 text-xs">
                  O documento fica retido aqui: o cidadão só o vê depois de
                  assinado.
                </p>
              </>
            )}
            <label className="mt-3 flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                className="checkbox-admin mt-0.5"
              />
              Confirmo que é um documento desmaterializado, apenas com
              assinatura física, que foi digitalizado.
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!confirmed}
                onClick={() => send("fisica")}
              >
                Enviar como documento físico digitalizado
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => send("sem")}
              >
                Enviar sem assinatura assim mesmo
              </Button>
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={cancel}
                className="text-warning-text"
              >
                Cancelar
              </Button>
            </div>
            <p className="mt-2 text-xs">
              A escolha fica registrada na auditoria.
            </p>
          </div>
        )}
      </form>
      {state.status === "error" && (
        <p role="alert" className="mt-2 text-sm font-medium text-destructive">
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
  held,
  certificates,
  canManageCertificates,
}: {
  requestId: string;
  attachmentId: string;
  /** Held back: the citizen sees it only once signed (or sent as it is). */
  held: boolean;
  certificates: DeliveryCertificate[];
  canManageCertificates: boolean;
}) {
  const router = useRouter();
  // A held file is there to be signed: the signing opens with it.
  const [open, setOpen] = useState(held);
  const [confirmUnsigned, setConfirmUnsigned] = useState(false);
  const [releaseState, release, releasing] = useActionState<
    ActionState,
    FormData
  >(
    async (previous, formData) => {
      const result = await releaseUnsignedAction(previous, formData);
      if (result.status === "success") {
        toast.success("Enviado sem assinatura. O cidadão já vê o documento.");
      }
      return result;
    },
    { status: "idle" },
  );
  const signedMessage = held
    ? "Documento assinado e enviado. O cidadão já baixa a versão assinada, com o QR de verificação."
    : "Documento assinado. O cidadão já baixa a versão assinada, com o QR de verificação.";
  // A1 from the platform or A3 from a token on this computer, the same
  // choice as in the assinador (decision of 11/11/2026).
  const [mode, setMode] = useState<Mode | null>(null);
  const local = useLocalSigner(mode === "a3");
  const [tokenBusy, setTokenBusy] = useState(false);
  const [tokenError, setTokenError] = useState("");
  const [state, action, pending] = useActionState<ActionState, FormData>(
    async (previous, formData) => {
      const result = await signDeliveredAction(previous, formData);
      if (result.status === "success") toast.success(signedMessage);
      return result;
    },
    { status: "idle" },
  );

  const signWithToken = async () => {
    const token = local.certificate;
    if (!token) {
      setTokenError("Escolha o certificado A3.");
      return;
    }
    setTokenError("");
    setTokenBusy(true);
    const data = certificateFields(new FormData(), token);
    data.set("requestId", requestId);
    data.set("attachmentId", attachmentId);
    const outcome = await signThroughToken(
      token,
      () => prepareA3DeliveryAction(data),
      finishA3DeliveryAction,
      { requestId, attachmentId },
    );
    setTokenBusy(false);
    if (outcome.status === "error") {
      setTokenError(outcome.message);
      return;
    }
    toast.success(signedMessage);
    router.refresh();
  };

  return (
    <div className="mt-1.5 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2.5 text-sm text-warning-text">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {held ? (
          <span>
            <strong>🔒 Aguardando assinatura.</strong> O cidadão ainda não vê
            este documento: ele é enviado assim que for assinado aqui.
          </span>
        ) : (
          <span>
            <strong>Enviado sem assinatura digital.</strong> O cidadão já baixa
            este PDF sem assinatura. Se assinar agora, ele passa a baixar a
            versão assinada.
          </span>
        )}
        <Button
          type="button"
          size="sm"
          onClick={() => setOpen((value) => !value)}
          className="shrink-0"
          aria-expanded={open}
        >
          Assinar digitalmente
        </Button>
      </div>
      {open && (
        <div className="mt-2 grid grid-cols-1 gap-2 text-foreground md:grid-cols-2">
          <ModeChoice
            mode={mode}
            onChange={setMode}
            hasA1={certificates.length > 0}
            prefix={`entrega-${attachmentId}`}
          />
          {mode === "a1" && (
            <form
              // Not `action={...}`: a wrong password would clear the fields.
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                startTransition(() => action(data));
              }}
              className="grid grid-cols-1 gap-2 md:col-span-2 md:grid-cols-[1fr_1fr_auto] md:items-end"
            >
              <input type="hidden" name="requestId" value={requestId} />
              <input type="hidden" name="attachmentId" value={attachmentId} />
              <label
                htmlFor={`certificado-${attachmentId}`}
                className="flex flex-col gap-2 text-sm font-medium text-foreground"
              >
                Certificado
                <NativeSelect
                  id={`certificado-${attachmentId}`}
                  name="certificateId"
                  required
                  className="w-full bg-background"
                >
                  {certificates.map((certificate) => (
                    <NativeSelectOption
                      key={certificate.id}
                      value={certificate.id}
                    >
                      {certificate.label} · {certificate.holderName}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </label>
              <label
                htmlFor={`senha-${attachmentId}`}
                className="flex flex-col gap-2 text-sm font-medium text-foreground"
              >
                Senha do certificado
                <Input
                  id={`senha-${attachmentId}`}
                  name="password"
                  type="password"
                  autoComplete="off"
                  required
                  className="bg-background font-normal"
                />
              </label>
              <Button type="submit" disabled={pending}>
                {pending ? "Assinando..." : "Assinar"}
              </Button>
              {state.status === "error" && (
                <p
                  role="alert"
                  className="font-medium text-destructive md:col-span-3"
                >
                  {state.message}
                </p>
              )}
            </form>
          )}
          {mode === "a3" && (
            <>
              <LocalSignerPicker
                signer={local}
                prefix={`entrega-${attachmentId}`}
              />
              <div className="md:col-span-2">
                <Button
                  type="button"
                  disabled={tokenBusy || !local.certificate}
                  onClick={() => void signWithToken()}
                >
                  {tokenBusy ? "Assinando..." : "Assinar com o token"}
                </Button>
                {tokenError && (
                  <p
                    role="alert"
                    className="mt-1.5 font-medium text-destructive"
                  >
                    {tokenError}
                  </p>
                )}
              </div>
            </>
          )}
          {certificates.length === 0 && canManageCertificates && (
            <p className="md:col-span-2">
              Para assinar com A1, cadastre o certificado em{" "}
              <Link
                href="/admin/configuracoes/certificados"
                className="font-medium underline underline-offset-4"
              >
                Configurações › Certificados
              </Link>
              .
            </p>
          )}
        </div>
      )}
      {held && (
        <div className="mt-2 border-t border-warning/30 pt-2">
          {confirmUnsigned ? (
            <form
              action={release}
              className="flex flex-wrap items-center gap-2"
            >
              <input type="hidden" name="requestId" value={requestId} />
              <input type="hidden" name="attachmentId" value={attachmentId} />
              <span className="font-semibold">
                Enviar ao cidadão sem assinatura digital? Fica registrado na
                auditoria.
              </span>
              <Button
                type="submit"
                variant="outline"
                size="sm"
                disabled={releasing}
              >
                {releasing ? "Enviando..." : "Sim, enviar sem assinatura"}
              </Button>
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={() => setConfirmUnsigned(false)}
                className="text-warning-text"
              >
                Voltar
              </Button>
            </form>
          ) : (
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={() => setConfirmUnsigned(true)}
              className="px-0 text-warning-text"
            >
              Enviar sem assinatura assim mesmo
            </Button>
          )}
          {releaseState.status === "error" && (
            <p role="alert" className="mt-1 font-medium text-destructive">
              {releaseState.message}
            </p>
          )}
        </div>
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
        className="mt-1 ml-1 cursor-pointer text-xs font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
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
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Salvando..." : "Salvar nome"}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(false)}
      >
        Cancelar
      </Button>
      {state.status === "error" && (
        <p
          role="alert"
          className="basis-full text-xs font-medium text-destructive"
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
