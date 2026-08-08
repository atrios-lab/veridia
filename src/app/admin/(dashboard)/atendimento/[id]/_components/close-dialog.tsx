"use client";

import { useActionState, useState } from "react";
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

  if (choice === "new") {
    return (
      <div className="border-b border-admin-border bg-admin-card px-5.5 py-4.5">
        <p className="text-[13px] text-admin-muted">
          Lançar um pedido novo a partir desta conversa: preencha o formulário,
          depois volte aqui para confirmar o encerramento.
        </p>
        <div className="mt-3 flex gap-2.5">
          <a
            href={`/admin/pedidos/novo?deConversa=${conversationId}`}
            className="rounded-[10px] bg-admin-primary-soft px-4.5 py-2.5 text-[13px] font-bold text-white"
          >
            Abrir lançamento manual
          </a>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-[10px] border border-admin-input-border px-4 py-2.5 text-[12.5px] font-bold text-admin-muted"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-admin-border bg-admin-card px-5.5 py-4.5">
      <h3 className="font-serif text-[16px] font-semibold text-admin-primary">
        Encerrar a conversa?
      </h3>
      <p className="mt-1 text-[13px] text-admin-muted">
        A transcrição fica guardada por 6 meses.
      </p>
      <form action={formAction} className="mt-3.5 flex flex-col gap-2">
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
          <p className="text-[12px] font-semibold text-admin-error-text">
            {state.message}
          </p>
        )}
        <div className="mt-2 flex gap-2.5">
          <button
            type="submit"
            disabled={pending}
            className="rounded-[10px] bg-admin-primary-soft px-4.5 py-2.5 text-[13px] font-bold text-white disabled:opacity-70"
          >
            Encerrar conversa
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-[10px] border border-admin-input-border px-4 py-2.5 text-[12.5px] font-bold text-admin-muted"
          >
            Voltar
          </button>
        </div>
      </form>
    </div>
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
