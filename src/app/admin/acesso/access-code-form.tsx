"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import {
  type AccessCodeState,
  confirmAccessCodeAction,
  sendAccessCodeAction,
} from "./actions.ts";

const IDLE: AccessCodeState = { status: "idle" };

export function AccessCodeForm({ next }: { next: string }) {
  const [sent, send, sending] = useActionState(sendAccessCodeAction, IDLE);
  const [checked, confirm, confirming] = useActionState(
    confirmAccessCodeAction,
    IDLE,
  );
  const asked = useRef(false);

  // The code goes out as the screen opens: one click less, every sign-in.
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    startTransition(() => send(new FormData()));
  }, [send]);

  return (
    <>
      <p
        aria-live="polite"
        className={`mt-4 rounded-[10px] px-3.5 py-2.5 text-[12.5px] ${sent.status === "error" ? "bg-admin-error-bg font-semibold text-admin-error-text" : "bg-admin-input-bg text-admin-text"}`}
      >
        {sending
          ? "Enviando o código..."
          : sent.status === "sent"
            ? `Enviamos um código de 6 dígitos para ${sent.to}. Ele vale por 10 minutos.`
            : sent.status === "error"
              ? sent.message
              : "Preparando o código..."}
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          startTransition(() => confirm(data));
        }}
        className="mt-4 flex flex-col gap-3"
      >
        <input type="hidden" name="next" value={next} />
        <label
          htmlFor="codigo-acesso"
          className="text-xs font-bold text-admin-primary"
        >
          Código de acesso
        </label>
        <input
          id="codigo-acesso"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={7}
          placeholder="000 000"
          required
          // biome-ignore lint/a11y/noAutofocus: the only field of the screen, reached right after the password.
          autoFocus
          className="rounded-[10px] border border-admin-input-border bg-admin-input-bg px-4 py-3 text-center text-[20px] tracking-[0.35em] text-admin-text outline-none focus:border-admin-primary-soft"
        />
        <label className="flex items-start gap-2 text-[12.5px] text-admin-text">
          <input
            type="checkbox"
            name="salvar"
            className="checkbox-admin mt-0.5"
          />
          <span>
            Salvar este dispositivo: não pedir o código de novo aqui.
            <span className="block text-[11.5px] text-admin-muted">
              Só no seu celular ou computador, ou num da serventia; nunca em
              aparelho público.
            </span>
          </span>
        </label>
        {checked.status === "error" && (
          <p
            role="alert"
            className="text-[12.5px] font-semibold text-admin-error-text"
          >
            {checked.message}
          </p>
        )}
        <button
          type="submit"
          disabled={confirming}
          className="btn btn-admin-primary btn-lg"
        >
          {confirming ? "Conferindo..." : "Entrar"}
        </button>
        <button
          type="button"
          disabled={sending}
          onClick={() => startTransition(() => send(new FormData()))}
          className="text-[12.5px] font-semibold text-admin-primary underline disabled:opacity-60"
        >
          Reenviar código
        </button>
      </form>
    </>
  );
}
