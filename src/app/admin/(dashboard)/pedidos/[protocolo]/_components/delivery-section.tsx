"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { type ActionState, deliverDocumentAction } from "../actions.ts";

export function DeliverySection({
  requestId,
  delivered,
}: {
  requestId: string;
  delivered: string[];
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    deliverDocumentAction,
    { status: "idle" },
  );

  useEffect(() => {
    if (state.status === "success") {
      toast.success("Documento entregue. Já aparece na consulta do cidadão.");
    }
    if (state.status === "error") toast.error(state.message);
  }, [state]);

  return (
    <div className="rounded-[14px] border border-admin-border bg-admin-card p-6">
      <h4 className="font-serif text-[17px] font-semibold text-admin-primary">
        Entrega ao cidadão
      </h4>
      <p className="mt-1 text-[12.5px] text-admin-muted">
        O que você anexar aqui fica disponível na consulta do cidadão.
      </p>

      {delivered.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {delivered.map((name) => (
            <li
              key={name}
              className="text-[12.5px] font-semibold text-admin-success-text"
            >
              {name}
            </li>
          ))}
        </ul>
      )}

      <form action={action} className="mt-3.5">
        <input type="hidden" name="requestId" value={requestId} />
        <label
          className={`flex cursor-pointer flex-col items-center gap-1 rounded-[11px] border-[1.5px] border-dashed border-admin-input-border px-5 py-5 text-center ${pending ? "opacity-60" : ""}`}
        >
          <span className="text-[13px] font-bold text-admin-primary">
            {pending ? "Enviando…" : "Anexar documento final"}
          </span>
          <span className="text-[12px] text-admin-faint">
            PDF assinado com selo digital
          </span>
          <input
            type="file"
            name="documento"
            accept="application/pdf,image/jpeg,image/png,image/webp,image/heic"
            className="sr-only"
            disabled={pending}
            onChange={(event) => {
              if (event.target.files?.length) {
                event.target.form?.requestSubmit();
              }
            }}
          />
        </label>
      </form>
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
