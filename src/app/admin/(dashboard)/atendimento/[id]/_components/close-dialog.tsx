"use client";

import { useActionState, useId, useState } from "react";
import { AdminDialog, DIALOG_FOOTER } from "../../../../_components/dialog.tsx";
import { Button, buttonVariants } from "../../../../_ui/button.tsx";
import { cn } from "../../../../_ui/cn.ts";
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
            className="text-lg leading-snug font-semibold text-foreground"
          >
            Lançar um pedido novo?
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Preencha o formulário e depois volte aqui para confirmar o
            encerramento. A conversa continua aberta até lá.
          </p>
        </div>
        <div className={DIALOG_FOOTER}>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <a
            href={`/admin/pedidos/novo?deConversa=${conversationId}`}
            className={buttonVariants()}
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
            className="text-lg leading-snug font-semibold text-foreground"
          >
            Encerrar a conversa?
          </h2>
          <p className="mb-2 text-sm leading-relaxed text-muted-foreground">
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
            <p role="alert" className="text-sm font-medium text-destructive">
              {state.message}
            </p>
          )}
        </div>
        <div className={DIALOG_FOOTER}>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={pending}
          >
            Voltar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Encerrando…" : "Encerrar conversa"}
          </Button>
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
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-2.5 transition-colors",
        checked ? "border-primary bg-muted/50" : "hover:bg-muted/50",
      )}
    >
      <input
        type="radio"
        checked={checked}
        onChange={onSelect}
        className="h-4 w-4 accent-primary"
      />
      <span className="text-sm text-foreground">{label}</span>
    </label>
  );
}
