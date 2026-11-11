"use client";

import { useActionState } from "react";
import {
  type ReleaseRequestState,
  requestAccessRelease,
} from "./access-hours-actions.ts";

const IDLE: ReleaseRequestState = { status: "idle" };

export function AccessReleaseForm({ pending }: { pending: boolean }) {
  const [state, action, sending] = useActionState(requestAccessRelease, IDLE);
  if (state.status === "sent" || (pending && state.status === "idle")) {
    return (
      <p className="mt-3 rounded-[12px] bg-admin-success-bg px-4 py-3 text-[13px] font-semibold text-admin-success-text">
        Pedido enviado ao Tabelião/Registrador. Quando ele liberar, é só
        recarregar esta página.
      </p>
    );
  }
  return (
    <form action={action} className="mt-3 flex flex-col gap-2">
      <label className="text-xs font-bold text-admin-primary" htmlFor="reason">
        Qual demanda você precisa acompanhar?
      </label>
      <textarea
        id="reason"
        name="reason"
        rows={3}
        required
        minLength={10}
        maxLength={500}
        placeholder="Ex.: conferir o protocolo de uma escritura com prazo amanhã cedo."
        className="w-full rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3.5 py-2.5 text-[13.5px] text-admin-text outline-none focus:border-admin-primary-soft"
      />
      {state.status === "error" && (
        <p
          role="alert"
          className="text-[12.5px] font-semibold text-admin-error-text"
        >
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={sending}
        className="btn btn-admin-primary btn-md self-start"
      >
        {sending ? "Enviando..." : "Pedir liberação ao Tabelião/Registrador"}
      </button>
    </form>
  );
}
