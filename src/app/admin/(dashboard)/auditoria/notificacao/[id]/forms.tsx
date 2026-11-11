"use client";

import { startTransition, useActionState, useEffect } from "react";
import { toast } from "sonner";
import { DocumentNameField } from "@/app/_components/document-name-field.tsx";
import { LONG_TEXT_MAX } from "@/core/text-limits.ts";
import {
  type AuditState,
  answerNotification,
  closeNotification,
  resendNotification,
  signNotification,
} from "../../actions.ts";
import { EvidenceFiles } from "../evidence-files.tsx";

const IDLE: AuditState = { status: "idle" };
const LABEL = "mb-1.5 block text-xs font-bold text-admin-primary";
const FIELD =
  "w-full rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3.5 py-2.5 text-[13.5px] text-admin-text outline-none focus:border-admin-primary-soft";

/** Posts without React clearing the fields when the action answers an error. */
function submitWith(dispatch: (data: FormData) => void) {
  return (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => dispatch(data));
  };
}

function useToast(state: AuditState) {
  useEffect(() => {
    if (state.status === "saved") toast.success(state.message);
  }, [state]);
}

function ErrorLine({ state }: { state: AuditState }) {
  return state.status === "error" ? (
    <p role="alert" className="text-[12.5px] text-admin-error-text">
      {state.message}
    </p>
  ) : null;
}

export function AnswerForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(answerNotification, IDLE);
  useToast(state);
  return (
    <form onSubmit={submitWith(action)} className="mt-2 flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      <div>
        <label htmlFor="a-resposta" className={LABEL}>
          Sua justificativa
        </label>
        <textarea
          id="a-resposta"
          name="resposta"
          required
          rows={6}
          maxLength={6000}
          className={FIELD}
        />
      </div>
      <DocumentNameField
        field="anexos"
        tone="admin"
        suggestions={[
          "Comprovante",
          "Captura de tela",
          "Documento",
          "Declaração",
        ]}
        hint="Nome dos arquivos que você anexar (opcional)."
      />
      <EvidenceFiles name="anexos" label="Anexos (opcional)" />
      <ErrorLine state={state} />
      <div>
        <button
          type="submit"
          disabled={pending}
          className="btn btn-admin-primary btn-md"
        >
          {pending ? "Enviando..." : "Enviar resposta"}
        </button>
      </div>
    </form>
  );
}

export function CloseForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(closeNotification, IDLE);
  useToast(state);
  return (
    <form onSubmit={submitWith(action)} className="mt-2 flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      <div>
        <label htmlFor="c-conclusao" className={LABEL}>
          Conclusão do Tabelião/Registrador (opcional)
        </label>
        <textarea
          id="c-conclusao"
          name="conclusao"
          rows={3}
          maxLength={LONG_TEXT_MAX}
          className={FIELD}
        />
      </div>
      <ErrorLine state={state} />
      <div>
        <button
          type="submit"
          disabled={pending}
          className="btn btn-admin-secondary btn-md"
        >
          {pending ? "Encerrando..." : "Encerrar notificação"}
        </button>
      </div>
    </form>
  );
}

export function ResendButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(resendNotification, IDLE);
  useToast(state);
  useEffect(() => {
    if (state.status === "error") toast.error(state.message);
  }, [state]);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        const data = new FormData();
        data.set("id", id);
        startTransition(() => action(data));
      }}
      className="btn btn-admin-secondary btn-sm"
    >
      {pending ? "Enviando..." : "Reenviar por e-mail"}
    </button>
  );
}

export function SignForm({
  id,
  certificates,
}: {
  id: string;
  certificates: { id: string; label: string; holderName: string }[];
}) {
  const [state, action, pending] = useActionState(signNotification, IDLE);
  useToast(state);
  return (
    <form
      onSubmit={submitWith(action)}
      className="mt-2 grid gap-3 sm:grid-cols-2"
    >
      <input type="hidden" name="id" value={id} />
      <div>
        <label htmlFor="s-cert" className={LABEL}>
          Certificado
        </label>
        <select id="s-cert" name="certificateId" required className={FIELD}>
          {certificates.map((certificate) => (
            <option key={certificate.id} value={certificate.id}>
              {certificate.label} · {certificate.holderName}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="s-password" className={LABEL}>
          Senha do certificado
        </label>
        <input
          id="s-password"
          name="password"
          type="password"
          autoComplete="off"
          required
          className={FIELD}
        />
      </div>
      <div className="sm:col-span-2">
        <ErrorLine state={state} />
        <button
          type="submit"
          disabled={pending}
          className="btn btn-admin-primary btn-md"
        >
          {pending ? "Assinando..." : "Assinar o PDF"}
        </button>
      </div>
    </form>
  );
}
