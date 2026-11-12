"use client";

import { startTransition, useActionState, useEffect } from "react";
import { toast } from "sonner";
import { DocumentNameField } from "@/app/_components/document-name-field.tsx";
import { LONG_TEXT_MAX } from "@/core/text-limits.ts";
import { Button } from "../../../../_ui/button.tsx";
import { Input } from "../../../../_ui/input.tsx";
import {
  NativeSelect,
  NativeSelectOption,
} from "../../../../_ui/native-select.tsx";
import { Textarea } from "../../../../_ui/textarea.tsx";
import {
  type AuditState,
  answerNotification,
  closeNotification,
  resendNotification,
  signNotification,
} from "../../actions.ts";
import { EvidenceFiles } from "../evidence-files.tsx";

const IDLE: AuditState = { status: "idle" };
const LABEL = "mb-1.5 block text-sm font-medium text-foreground";

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
    <p role="alert" className="text-xs text-destructive">
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
        <Textarea
          id="a-resposta"
          name="resposta"
          required
          rows={6}
          maxLength={6000}
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
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Enviando..." : "Enviar resposta"}
        </Button>
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
        <Textarea
          id="c-conclusao"
          name="conclusao"
          rows={3}
          maxLength={LONG_TEXT_MAX}
        />
      </div>
      <ErrorLine state={state} />
      <div>
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Encerrando..." : "Encerrar notificação"}
        </Button>
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
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => {
        const data = new FormData();
        data.set("id", id);
        startTransition(() => action(data));
      }}
    >
      {pending ? "Enviando..." : "Reenviar por e-mail"}
    </Button>
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
        <NativeSelect
          id="s-cert"
          name="certificateId"
          required
          className="w-full"
        >
          {certificates.map((certificate) => (
            <NativeSelectOption key={certificate.id} value={certificate.id}>
              {certificate.label} · {certificate.holderName}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div>
        <label htmlFor="s-password" className={LABEL}>
          Senha do certificado
        </label>
        <Input
          id="s-password"
          name="password"
          type="password"
          autoComplete="off"
          required
        />
      </div>
      <div className="flex flex-col items-start gap-3 sm:col-span-2">
        <ErrorLine state={state} />
        <Button type="submit" disabled={pending}>
          {pending ? "Assinando..." : "Assinar o PDF"}
        </Button>
      </div>
    </form>
  );
}
