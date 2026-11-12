"use client";

import { useActionState, useEffect, useState } from "react";
import { documentHref } from "../../../../_components/attachment-link.ts";
import { Button } from "../../../../_ui/button.tsx";
import { Input } from "../../../../_ui/input.tsx";
import { type ActionState, setAmountAction } from "../actions.ts";

export function AmountSection({
  requestId,
  amountLabel,
  receipt,
}: {
  requestId: string;
  amountLabel?: string;
  /** The comprovante the citizen sent via "Já paguei", if any: the most
   * recent one, if they sent more than one. */
  receipt?: { id: string; displayName: string; sentAtLabel: string };
}) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    setAmountAction,
    { status: "idle" },
  );

  useEffect(() => {
    if (state.status === "success") setEditing(false);
  }, [state]);

  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="flex items-center gap-2">
        <h4 className="flex-1 text-base font-semibold text-foreground">
          Valor do pedido
        </h4>
        {!editing && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setEditing(true)}
          >
            {amountLabel ? "Corrigir valor" : "Informar valor"}
          </Button>
        )}
        {!editing && amountLabel && (
          <form action={action}>
            <input type="hidden" name="requestId" value={requestId} />
            <input type="hidden" name="intent" value="clear" />
            <Button
              type="submit"
              variant="outline"
              size="sm"
              disabled={pending}
            >
              Remover valor
            </Button>
          </form>
        )}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {amountLabel
          ? `Valor atual: ${amountLabel}`
          : "Ainda não informado. Ao salvar o valor, o pedido passa sozinho para Aguardando pagamento e o cliente vê o Pix (QR Code) na consulta do protocolo."}
      </p>
      {receipt && (
        <p className="mt-1.5 text-sm text-foreground">
          Pagamento informado em {receipt.sentAtLabel} ·{" "}
          <a
            href={documentHref(requestId, receipt.id)}
            target="_blank"
            rel="noopener"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            ver comprovante
          </a>
        </p>
      )}

      {editing && (
        <form action={action} className="mt-4 flex items-center gap-2">
          <input type="hidden" name="requestId" value={requestId} />
          <Input
            type="text"
            name="amount"
            inputMode="decimal"
            placeholder="0,00"
            aria-label="Valor do pedido"
            className="w-32"
          />
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando…" : "Salvar"}
          </Button>
        </form>
      )}
      {state.status === "error" && (
        <p role="alert" className="mt-2 text-sm font-medium text-destructive">
          {state.message}
        </p>
      )}
    </div>
  );
}
