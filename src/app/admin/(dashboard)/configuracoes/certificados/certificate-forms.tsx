"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "../../../_components/confirm-action.tsx";
import {
  addCertificate,
  type CertificateState,
  disableCertificate,
  saveSigners,
} from "./actions.ts";

const FIELD =
  "w-full rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3.5 py-2.5 text-[13.5px] text-admin-text outline-none focus:border-admin-primary-soft";
const LABEL = "mb-1.5 block text-xs font-bold text-admin-primary";
const IDLE: CertificateState = { status: "idle" };

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

function useToast(state: CertificateState) {
  useEffect(() => {
    if (state.status === "saved") toast.success(state.message);
  }, [state]);
}

export function AddCertificateForm() {
  const [state, action, pending] = useActionState(addCertificate, IDLE);
  const form = useRef<HTMLFormElement>(null);
  useToast(state);
  useEffect(() => {
    // The password never stays on screen once the file is in.
    if (state.status === "saved") form.current?.reset();
  }, [state]);

  return (
    <form
      ref={form}
      onSubmit={keepFields(action)}
      className="rounded-[14px] border border-admin-border bg-admin-card px-5 py-4"
    >
      <h3 className="font-serif text-[16px] font-semibold text-admin-primary">
        Cadastrar certificado A1
      </h3>
      <div className="mt-3 grid grid-cols-1 gap-3.5 md:grid-cols-2">
        <div>
          <label htmlFor="cert-label" className={LABEL}>
            Nome para identificar
          </label>
          <input
            id="cert-label"
            name="label"
            placeholder="Ex.: Titular, Substituto, e-CNPJ da serventia"
            className={FIELD}
          />
        </div>
        <div>
          <label htmlFor="cert-file" className={LABEL}>
            Arquivo do certificado (.pfx ou .p12)
          </label>
          <input
            id="cert-file"
            name="pfx"
            type="file"
            accept=".pfx,.p12,application/x-pkcs12"
            required
            className="w-full text-[13px] text-admin-text"
          />
        </div>
        <div>
          <label htmlFor="cert-password" className={LABEL}>
            Senha do certificado
          </label>
          <input
            id="cert-password"
            name="password"
            type="password"
            autoComplete="off"
            required
            className={FIELD}
          />
          <p className="mt-1 text-[11.5px] text-admin-muted">
            Usada só para conferir o certificado agora. Não é guardada.
          </p>
        </div>
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
        {pending ? "Conferindo..." : "Cadastrar certificado"}
      </button>
    </form>
  );
}

export function CertificateSigners({
  certificateId,
  people,
  allowed,
}: {
  certificateId: string;
  people: { id: string; name: string; role: string }[];
  allowed: string[];
}) {
  const [state, action, pending] = useActionState(saveSigners, IDLE);
  useToast(state);
  return (
    <form
      onSubmit={keepFields(action)}
      className="mt-3.5 border-t border-admin-border pt-3"
    >
      <input type="hidden" name="certificateId" value={certificateId} />
      <fieldset>
        <legend className="text-xs font-bold text-admin-primary">
          Quem pode assinar com este certificado
        </legend>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-admin-text">
          {people.map((person) => (
            <label key={person.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                name="signer"
                value={person.id}
                defaultChecked={allowed.includes(person.id)}
                className="checkbox-admin"
              />
              {person.name}
              <span className="text-[11.5px] text-admin-muted">
                ({person.role === "admin" ? "administrador" : "equipe"})
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {state.status === "error" && (
        <p
          role="alert"
          className="mt-2 text-[12.5px] font-semibold text-admin-error-text"
        >
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="btn btn-admin-secondary btn-sm mt-3"
      >
        {pending ? "Salvando..." : "Salvar autorizações"}
      </button>
    </form>
  );
}

export function DisableCertificate({
  certificateId,
}: {
  certificateId: string;
}) {
  const [state, action, pending] = useActionState(disableCertificate, IDLE);
  useToast(state);
  return (
    <div className="mt-3">
      <ConfirmAction
        action={action}
        pending={pending}
        error={state.status === "error" ? state.message : null}
        trigger="Desativar certificado"
        question="Desativar este certificado?"
        consequence="Ninguém mais assina com ele. Os documentos já assinados continuam válidos e verificáveis. Para usar de novo, cadastre o arquivo outra vez."
        confirmLabel="Desativar"
        pendingLabel="Desativando…"
      >
        <input type="hidden" name="certificateId" value={certificateId} />
      </ConfirmAction>
    </div>
  );
}
