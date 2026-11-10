"use client";

import { startTransition, useActionState } from "react";
import { coSignDocument, type SignState, signDocument } from "./actions.ts";

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

export function SignForm({
  certificates,
}: {
  certificates: CertificateOption[];
}) {
  const [state, action, pending] = useActionState(signDocument, IDLE);
  return (
    <form
      onSubmit={keepFields(action)}
      className="rounded-[14px] border border-admin-border bg-admin-card px-5 py-4"
    >
      <h2 className="font-serif text-[17px] font-semibold text-admin-primary">
        Assinar um documento
      </h2>
      <p className="mt-1 text-[12.5px] leading-relaxed text-admin-muted">
        Envie o PDF (até 4 MB). Cada página recebe a faixa de assinatura e o QR
        Code de verificação, e o documento é assinado no padrão PAdES
        ICP-Brasil. Um PDF que já tem assinatura recebe só a nova assinatura,
        sem a faixa, para não invalidar as anteriores.
      </p>
      <div className="mt-3.5 grid grid-cols-1 gap-3.5 md:grid-cols-2">
        <div className="md:col-span-2">
          <label htmlFor="sign-file" className={LABEL}>
            PDF a assinar
          </label>
          <input
            id="sign-file"
            name="pdf"
            type="file"
            accept="application/pdf,.pdf"
            required
            className="w-full text-[13px] text-admin-text"
          />
        </div>
        <div className="md:col-span-2">
          <label htmlFor="sign-title" className={LABEL}>
            Título do documento
          </label>
          <input
            id="sign-title"
            name="title"
            placeholder="Ex.: Certidão de inteiro teor, matrícula 1.234"
            className={FIELD}
          />
          <p className="mt-1 text-[11.5px] text-admin-muted">
            Aparece na página de verificação para quem tiver o código. Evite
            nome e CPF de pessoas aqui.
          </p>
        </div>
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
        {pending ? "Assinando..." : "Assinar digitalmente"}
      </button>
    </form>
  );
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
