"use client";

import { useActionState, useEffect, useState } from "react";
import { type ActionState, setAmountAction } from "../actions.ts";

export function AmountSection({
  requestId,
  amountLabel,
}: {
  requestId: string;
  amountLabel?: string;
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
    <div className="rounded-[14px] border border-admin-border bg-admin-card p-6">
      <div className="flex items-center gap-2.5">
        <h4 className="flex-1 font-serif text-[17px] font-semibold text-admin-primary">
          Valor do pedido
        </h4>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="btn btn-admin-secondary btn-sm"
          >
            {amountLabel ? "Corrigir valor" : "Informar valor"}
          </button>
        )}
      </div>
      <p className="mt-1 text-[12.5px] text-admin-muted">
        {amountLabel
          ? `Valor atual: ${amountLabel}`
          : "Ainda não informado: o cidadão só vê e paga depois que você preencher aqui."}
      </p>

      {editing && (
        <form action={action} className="mt-3.5 flex items-center gap-2.5">
          <input type="hidden" name="requestId" value={requestId} />
          <input
            type="text"
            name="amount"
            inputMode="decimal"
            placeholder="0,00"
            className="w-32 rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3.5 py-2 text-[13px] text-admin-text"
          />
          <button
            type="submit"
            disabled={pending}
            className="btn btn-admin-primary btn-md"
          >
            {pending ? "Salvando…" : "Salvar"}
          </button>
        </form>
      )}
      {state.status === "error" && (
        <p
          role="alert"
          className="mt-2 text-[12.5px] font-semibold text-admin-error-text"
        >
          {state.message}
        </p>
      )}
    </div>
  );
}
