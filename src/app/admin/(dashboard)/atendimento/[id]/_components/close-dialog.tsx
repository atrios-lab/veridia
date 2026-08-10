"use client";

import { useActionState, useId, useState } from "react";
import { AdminDialog, DIALOG_FOOTER } from "../../../../_components/dialog.tsx";
import { type ActionState, closeConversationAction } from "../actions.ts";

type Choice = "link" | "new" | "none";

export function CloseDialog({
  conversationId,
  matchedRequestId,
  onCancel,
}: {
  conversationId: string;
  matchedRequestId: string | null;
  onCancel: () => void;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    closeConversationAction,
    { status: "idle" },
  );
  const [choice, setChoice] = useState<Choice>(
    matchedRequestId ? "link" : "none",
  );
  const headingId = useId();

  if (choice === "new") {
    return (
      <AdminDialog labelledBy={headingId} onClose={onCancel}>
        <div className="dialog-body">
          <h2
            id={headingId}
            className="font-serif text-[18px] font-semibold text-admin-primary"
          >
            Lançar um pedido novo?
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed text-admin-muted">
            Preencha o formulário e depois volte aqui para confirmar o
            encerramento. A conversa continua aberta até lá.
          </p>
        </div>
        <div className={DIALOG_FOOTER}>
          <button
            type="button"
            onClick={onCancel}
            className="btn btn-admin-secondary btn-md"
          >
            Cancelar
          </button>
          <a
            href={`/admin/pedidos/novo?deConversa=${conversationId}`}
            className="btn btn-admin-primary btn-md"
          >
            Abrir lançamento manual
          </a>
        </div>
      </AdminDialog>
    );
  }

  return (
    <AdminDialog
      labelledBy={headingId}
      onClose={() => {
        if (!pending) onCancel();
      }}
    >
      <form action={formAction}>
        <div className="dialog-body flex flex-col gap-2">
          <h2
            id={headingId}
            className="font-serif text-[18px] font-semibold text-admin-primary"
          >
            Encerrar a conversa?
          </h2>
          <p className="mb-2 text-[13px] leading-relaxed text-admin-muted">
            A transcrição fica guardada por 6 meses.
          </p>
          <input type="hidden" name="conversationId" value={conversationId} />
          {matchedRequestId && (
            <input
              type="hidden"
              name="linkedRequestId"
              value={choice === "link" ? matchedRequestId : ""}
            />
          )}
          {matchedRequestId && (
            <RadioOption
              checked={choice === "link"}
              onSelect={() => setChoice("link")}
              label="Vincular ao pedido localizado no pré-chat"
            />
          )}
          <RadioOption
            checked={false}
            onSelect={() => setChoice("new")}
            label="Lançar um pedido novo a partir desta conversa"
          />
          <RadioOption
            checked={choice === "none"}
            onSelect={() => setChoice("none")}
            label="Só encerrar, sem vincular"
          />
          {state.status === "error" && (
            <p
              role="alert"
              className="text-[12.5px] font-semibold text-admin-error-text"
            >
              {state.message}
            </p>
          )}
        </div>
        <div className={DIALOG_FOOTER}>
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="btn btn-admin-secondary btn-md"
          >
            Voltar
          </button>
          <button
            type="submit"
            disabled={pending}
            className="btn btn-admin-primary btn-md"
          >
            {pending ? "Encerrando…" : "Encerrar conversa"}
          </button>
        </div>
      </form>
    </AdminDialog>
  );
}

function RadioOption({
  checked,
  onSelect,
  label,
}: {
  checked: boolean;
  onSelect: () => void;
  label: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-3 rounded-[10px] border px-3.5 py-2.5 ${
        checked
          ? "border-admin-primary-soft bg-admin-input-bg"
          : "border-admin-border"
      }`}
    >
      <input
        type="radio"
        checked={checked}
        onChange={onSelect}
        className="h-4 w-4"
      />
      <span className="text-[13px] text-admin-text">{label}</span>
    </label>
  );
}
