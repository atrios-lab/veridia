"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useActionState, useRef, useState } from "react";
import { ConfirmAction } from "../../../_components/confirm-action.tsx";
import {
  coSignDocument,
  type SignState,
  setDocumentRemoved,
  signOneDocument,
} from "./actions.ts";

const FIELD =
  "w-full rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3.5 py-2.5 text-[13.5px] text-admin-text outline-none focus:border-admin-primary-soft";
const LABEL = "mb-1.5 block text-xs font-bold text-admin-primary";
const IDLE: SignState = { status: "idle" };

/**
 * Submits without `action={...}`: React clears a form after its action, and
 * a wrong password would cost the file the person already chose.
 */
function keepFields(dispatch: (data: FormData) => void) {
  return (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => dispatch(data));
  };
}

export interface CertificateOption {
  id: string;
  label: string;
  holderName: string;
}

function CertificateAndPassword({
  certificates,
  prefix,
}: {
  certificates: CertificateOption[];
  prefix: string;
}) {
  return (
    <>
      <div>
        <label htmlFor={`${prefix}-cert`} className={LABEL}>
          Certificado
        </label>
        <select
          id={`${prefix}-cert`}
          name="certificateId"
          required
          className={FIELD}
        >
          {certificates.map((certificate) => (
            <option key={certificate.id} value={certificate.id}>
              {certificate.label} · {certificate.holderName}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`${prefix}-password`} className={LABEL}>
          Senha do certificado
        </label>
        <input
          id={`${prefix}-password`}
          name="password"
          type="password"
          autoComplete="off"
          required
          className={FIELD}
        />
      </div>
    </>
  );
}

interface Chosen {
  key: string;
  file: File;
  title: string;
  state:
    | { kind: "waiting" }
    | { kind: "signing" }
    | { kind: "signed"; id: string }
    | { kind: "error"; message: string };
}

const MAX_FILES = 20;
const MAX_BYTES = 4 * 1024 * 1024;

/**
 * One PDF or several at once (decision of 11/11/2026), with the
 * certificate and password typed once. Each file goes in its own request,
 * in order; a wrong password stops the rest. One PDF opens its page when
 * signed; several stay listed here, each with its link, and "Assinar
 * outros" starts over.
 */
export function SignForm({
  certificates,
}: {
  certificates: CertificateOption[];
}) {
  const router = useRouter();
  const [files, setFiles] = useState<Chosen[]>([]);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const finished =
    files.length > 0 &&
    files.every((f) => f.state.kind === "signed" || f.state.kind === "error") &&
    !running;

  const choose = (list: FileList | null) => {
    setError("");
    const picked = Array.from(list ?? []);
    const pdfs = picked.filter(
      (file) => file.type === "application/pdf" || /\.pdf$/i.test(file.name),
    );
    if (pdfs.length < picked.length) setError("Só arquivos PDF.");
    if (pdfs.length > MAX_FILES) {
      setError(`Até ${MAX_FILES} PDFs por vez.`);
    }
    setFiles(
      pdfs.slice(0, MAX_FILES).map((file, index) => ({
        key: `${index}-${file.name}-${file.size}`,
        file,
        title: file.name.replace(/\.pdf$/i, ""),
        state:
          file.size > MAX_BYTES
            ? { kind: "error", message: "Passa de 4 MB." }
            : { kind: "waiting" },
      })),
    );
  };

  const update = (key: string, patch: Partial<Chosen>) =>
    setFiles((current) =>
      current.map((f) => (f.key === key ? { ...f, ...patch } : f)),
    );

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const queue = files.filter((f) => f.state.kind === "waiting");
    if (!queue.length) {
      setError("Escolha o PDF a assinar.");
      return;
    }
    setError("");
    setRunning(true);
    let lastId = "";
    let signedCount = 0;
    for (const item of queue) {
      update(item.key, { state: { kind: "signing" } });
      const data = new FormData();
      data.set("pdf", item.file);
      data.set("title", item.title);
      data.set("certificateId", String(form.get("certificateId") ?? ""));
      data.set("password", String(form.get("password") ?? ""));
      if (form.get("manifest") === "on") data.set("manifest", "on");
      const result = await signOneDocument(data);
      if (result.status === "signed") {
        lastId = result.id;
        signedCount++;
        update(item.key, { state: { kind: "signed", id: result.id } });
      } else {
        update(item.key, {
          state: { kind: "error", message: result.message },
        });
        if (result.stop) {
          setError(result.message);
          // The rest stay waiting: fix the password and send again.
          break;
        }
      }
    }
    setRunning(false);
    if (queue.length === 1 && signedCount === 1) {
      router.push(`/admin/utilitarios/assinador/${lastId}?assinado=1`);
      return;
    }
    router.refresh();
  };

  const restart = () => {
    setFiles([]);
    setError("");
    if (input.current) input.current.value = "";
  };

  return (
    <form
      id="assinar"
      onSubmit={submit}
      className="scroll-mt-4 rounded-[14px] border border-admin-border bg-admin-card px-5 py-4"
    >
      <h2 className="font-serif text-[17px] font-semibold text-admin-primary">
        Assinar documentos
      </h2>
      <p className="mt-1 text-[12.5px] leading-relaxed text-admin-muted">
        Um PDF ou vários de uma vez (até 4 MB cada). Cada página recebe a faixa
        de assinatura e o QR Code de verificação, no padrão PAdES ICP-Brasil. Um
        PDF que já vem assinado (uma CNH, uma certidão de outra serventia)
        recebe a faixa e o QR na primeira página, como parte da nova assinatura,
        sem invalidar as anteriores.
      </p>
      <div className="mt-3.5 grid grid-cols-1 gap-3.5 md:grid-cols-2">
        <div className="md:col-span-2">
          <span className={LABEL}>PDFs a assinar</span>
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-[12px] border-2 border-dashed border-admin-input-border bg-admin-card px-4 py-5 text-center focus-within:ring-2 focus-within:ring-admin-accent hover:border-admin-primary hover:bg-admin-input-bg">
            <span className="btn btn-admin-primary btn-md">
              {files.length ? "Trocar arquivos" : "Escolher arquivos"}
            </span>
            <span className="text-[12px] text-admin-muted">
              Um ou vários PDFs, até 4 MB cada
            </span>
            <input
              ref={input}
              type="file"
              multiple
              accept="application/pdf,.pdf"
              className="sr-only"
              disabled={running}
              onChange={(event) => choose(event.target.files)}
            />
          </label>
        </div>
        {files.length > 0 && (
          <ul className="flex flex-col gap-2 md:col-span-2">
            {files.map((item) => (
              <li
                key={item.key}
                className="rounded-[10px] border border-admin-border px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-2 text-[12px]">
                  <span className="min-w-0 truncate text-admin-muted">
                    {item.file.name} ·{" "}
                    {Math.max(1, Math.round(item.file.size / 1024))} KB
                  </span>
                  <ItemState item={item} />
                </div>
                <label className="mt-1.5 block">
                  <span className="sr-only">Título de {item.file.name}</span>
                  <input
                    value={item.title}
                    disabled={item.state.kind !== "waiting" || running}
                    onChange={(event) =>
                      update(item.key, { title: event.target.value })
                    }
                    placeholder="Título do documento"
                    className={FIELD}
                  />
                </label>
              </li>
            ))}
            <li className="text-[11.5px] text-admin-muted">
              O título aparece na página de verificação para quem tiver o
              código. Evite nome e CPF de pessoas.
            </li>
          </ul>
        )}
        <CertificateAndPassword certificates={certificates} prefix="sign" />
      </div>
      <label className="mt-3.5 flex items-center gap-2 text-[13px] text-admin-text">
        <input
          type="checkbox"
          name="manifest"
          defaultChecked
          className="checkbox-admin"
        />
        Incluir o manifesto de assinaturas no fim do documento
      </label>
      {error && (
        <p
          role="alert"
          className="mt-3 text-[12.5px] font-semibold text-admin-error-text"
        >
          {error}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {!finished && (
          <button
            type="submit"
            disabled={running}
            className="btn btn-admin-primary btn-md"
          >
            {running
              ? "Assinando..."
              : files.length > 1
                ? `Assinar ${files.filter((f) => f.state.kind === "waiting").length} documentos`
                : "Assinar digitalmente"}
          </button>
        )}
        {finished && (
          <button
            type="button"
            onClick={restart}
            className="btn btn-admin-primary btn-md"
          >
            Assinar outros documentos
          </button>
        )}
      </div>
    </form>
  );
}

function ItemState({ item }: { item: Chosen }) {
  switch (item.state.kind) {
    case "signing":
      return (
        <span className="shrink-0 font-semibold text-admin-primary">
          Assinando...
        </span>
      );
    case "signed":
      return (
        <span className="flex shrink-0 items-center gap-2">
          <span className="font-semibold text-admin-success-text">
            Assinado
          </span>
          <Link
            href={`/admin/utilitarios/assinador/${item.state.id}`}
            className="font-semibold text-admin-primary underline"
          >
            Abrir
          </Link>
        </span>
      );
    case "error":
      return (
        <span className="shrink-0 font-semibold text-admin-error-text">
          {item.state.message}
        </span>
      );
    default:
      return <span className="shrink-0 text-admin-muted">Na fila</span>;
  }
}

export function CoSignForm({
  documentId,
  certificates,
}: {
  documentId: string;
  certificates: CertificateOption[];
}) {
  const [state, action, pending] = useActionState(coSignDocument, IDLE);
  return (
    <form
      onSubmit={keepFields(action)}
      className="rounded-[14px] border border-admin-border bg-admin-card px-5 py-4"
    >
      <input type="hidden" name="documentId" value={documentId} />
      <h2 className="font-serif text-[16px] font-semibold text-admin-primary">
        Assinar também
      </h2>
      <p className="mt-1 text-[12.5px] text-admin-muted">
        Mais uma assinatura no mesmo documento. As anteriores continuam válidas.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-3.5 md:grid-cols-2">
        <CertificateAndPassword certificates={certificates} prefix="cosign" />
      </div>
      {state.status === "error" && (
        <p
          role="alert"
          className="mt-3 text-[12.5px] font-semibold text-admin-error-text"
        >
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="btn btn-admin-primary btn-md mt-4"
      >
        {pending ? "Assinando..." : "Assinar"}
      </button>
    </form>
  );
}

/**
 * "Excluir" from the office's list: nothing is erased (decision of
 * 11/11/2026). The file stops opening, here and on the public page; the
 * verification still answers for the code, and it can be put back.
 */
export function RemoveDocumentButton({
  documentId,
  title,
}: {
  documentId: string;
  title: string;
}) {
  const [state, action, pending] = useActionState(setDocumentRemoved, IDLE);
  return (
    <ConfirmAction
      action={action}
      pending={pending}
      error={state.status === "error" ? state.message : null}
      trigger="Excluir da lista"
      question="Excluir este documento da lista?"
      consequence={`"${title}" sai da lista e o arquivo assinado deixa de abrir, aqui e na página pública. O registro da assinatura continua respondendo à verificação, como manda a guarda dos atos, e o documento pode voltar à lista em "Excluídos".`}
      confirmLabel="Excluir da lista"
      pendingLabel="Excluindo…"
    >
      <input type="hidden" name="documentId" value={documentId} />
      <input type="hidden" name="removed" value="1" />
    </ConfirmAction>
  );
}

export function RestoreDocumentButton({ documentId }: { documentId: string }) {
  const [state, action, pending] = useActionState(setDocumentRemoved, IDLE);
  return (
    <form action={action} className="inline">
      <input type="hidden" name="documentId" value={documentId} />
      <input type="hidden" name="removed" value="0" />
      <button
        type="submit"
        disabled={pending}
        className="btn btn-admin-secondary btn-sm"
      >
        {pending ? "Devolvendo…" : "Devolver à lista"}
      </button>
      {state.status === "error" && (
        <span role="alert" className="ml-2 text-[12px] text-admin-error-text">
          {state.message}
        </span>
      )}
    </form>
  );
}
