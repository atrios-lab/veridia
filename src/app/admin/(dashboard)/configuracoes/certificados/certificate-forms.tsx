"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import type { Role } from "@/core/auth/roles.ts";
import { ConfirmAction } from "../../../_components/confirm-action.tsx";
import { FilePicker } from "../../../_components/file-picker.tsx";
import { ROLE_LABELS } from "../../../_components/role-labels.ts";
import { Button } from "../../../_ui/button.tsx";
import { Input } from "../../../_ui/input.tsx";
import { Label } from "../../../_ui/label.tsx";
import {
  addCertificate,
  type CertificateState,
  disableCertificate,
  saveSigners,
} from "./actions.ts";

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
      className="rounded-xl border bg-card px-5 py-4"
    >
      <h3 className="text-base font-semibold text-foreground">
        Cadastrar certificado A1
      </h3>
      <div className="mt-3 grid grid-cols-1 gap-3.5 md:grid-cols-2">
        <div>
          <Label htmlFor="cert-label" className="mb-1.5">
            Nome para identificar
          </Label>
          <Input
            id="cert-label"
            name="label"
            placeholder="Ex.: Titular, Substituto, e-CNPJ da serventia"
          />
        </div>
        <div className="md:col-span-2">
          <FilePicker
            name="pfx"
            accept=".pfx,.p12,application/x-pkcs12"
            label="Arquivo do certificado (.pfx ou .p12)"
            hint="Clique para escolher o arquivo do certificado A1"
            required
          />
        </div>
        <div>
          <Label htmlFor="cert-password" className="mb-1.5">
            Senha do certificado
          </Label>
          <Input
            id="cert-password"
            name="password"
            type="password"
            autoComplete="off"
            required
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Usada só para conferir o certificado agora. Não é guardada.
          </p>
        </div>
      </div>
      {state.status === "error" && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={pending} className="mt-4">
        {pending ? "Conferindo..." : "Cadastrar certificado"}
      </Button>
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
    <form onSubmit={keepFields(action)} className="mt-3.5 border-t pt-3">
      <input type="hidden" name="certificateId" value={certificateId} />
      <fieldset>
        <legend className="text-sm font-medium text-foreground">
          Quem pode assinar com este certificado
        </legend>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm text-foreground">
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
              <span className="text-xs text-muted-foreground">
                ({ROLE_LABELS[person.role as Role] ?? person.role})
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {state.status === "error" && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {state.message}
        </p>
      )}
      <Button
        type="submit"
        disabled={pending}
        variant="outline"
        size="sm"
        className="mt-3"
      >
        {pending ? "Salvando..." : "Salvar autorizações"}
      </Button>
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
