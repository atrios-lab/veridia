"use client";

import { startTransition, useActionState } from "react";
import {
  type CodeState,
  requestSigningCodeAction,
} from "../(dashboard)/utilitarios/assinador/actions.ts";

const FIELD =
  "w-full rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3.5 py-2.5 text-[13.5px] tracking-[0.2em] text-admin-text outline-none focus:border-admin-primary-soft";

/**
 * The second factor of a signature: a six-digit code sent to the signer's
 * own e-mail, valid for ten minutes and for every signature in that time.
 * The button is not a submit of the signing form: it posts on its own.
 */
export function SigningCodeField({ id }: { id: string }) {
  const [state, action, pending] = useActionState<CodeState, FormData>(
    requestSigningCodeAction,
    { status: "idle" },
  );
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-xs font-bold text-admin-primary"
      >
        Código de confirmação (e-mail)
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={7}
          placeholder="000000"
          required
          className={FIELD}
        />
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => action(new FormData()))}
          className="btn btn-admin-secondary btn-md shrink-0"
        >
          {pending
            ? "Enviando..."
            : state.status === "sent"
              ? "Reenviar"
              : "Enviar código"}
        </button>
      </div>
      <p
        aria-live="polite"
        className={`mt-1 text-[11.5px] ${state.status === "error" ? "font-semibold text-admin-error-text" : "text-admin-muted"}`}
      >
        {state.status === "sent"
          ? `Código enviado para ${state.to}. Vale por 10 minutos, para todas as assinaturas nesse tempo.`
          : state.status === "error"
            ? state.message
            : "Por segurança, cada assinatura pede um código enviado ao seu e-mail do painel."}
      </p>
    </div>
  );
}
