"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  confirmOwnEmail,
  forgetOwnComputers,
  type OwnAccessState,
  requestOwnEmail,
} from "./actions.ts";

const IDLE: OwnAccessState = { status: "idle" };
const FIELD =
  "rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3.5 py-2.5 text-[13.5px] text-admin-text outline-none focus:border-admin-primary-soft";

function keep(dispatch: (data: FormData) => void) {
  return (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => dispatch(data));
  };
}

export function OwnAccessForms({
  accountEmail,
  ownEmail,
}: {
  accountEmail: string;
  ownEmail: string;
}) {
  const [email, setEmail] = useState(ownEmail);
  const [requested, request, requesting] = useActionState(
    requestOwnEmail,
    IDLE,
  );
  const [confirmed, confirm, confirming] = useActionState(
    confirmOwnEmail,
    IDLE,
  );
  const [forgot, forget, forgetting] = useActionState(forgetOwnComputers, IDLE);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  useEffect(() => {
    if (requested.status === "code-sent") setPendingEmail(requested.email);
    if (requested.status === "saved") {
      toast.success(requested.message);
      setPendingEmail(null);
    }
  }, [requested]);
  useEffect(() => {
    if (confirmed.status === "saved") {
      toast.success(confirmed.message);
      setPendingEmail(null);
    }
  }, [confirmed]);
  useEffect(() => {
    if (forgot.status === "saved") toast.success(forgot.message);
  }, [forgot]);

  return (
    <section className="flex flex-col gap-4 rounded-[14px] border border-admin-border bg-admin-card px-5 py-4">
      <form onSubmit={keep(request)} className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-bold text-admin-primary">
          Meu e-mail de verificação
          <input
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={`${accountEmail} (o da conta)`}
            className={`${FIELD} font-normal`}
          />
        </label>
        <button
          type="submit"
          disabled={requesting}
          className="btn btn-admin-primary btn-md"
        >
          {requesting
            ? "Enviando..."
            : email.trim()
              ? "Enviar código ao novo e-mail"
              : "Usar o e-mail da conta"}
        </button>
        {ownEmail && (
          <button
            type="button"
            disabled={requesting}
            onClick={() => {
              setEmail("");
              startTransition(() => request(new FormData()));
            }}
            className="btn btn-admin-secondary btn-md"
          >
            Apagar
          </button>
        )}
      </form>
      {requested.status === "error" && (
        <p
          role="alert"
          className="text-[12.5px] font-semibold text-admin-error-text"
        >
          {requested.message}
        </p>
      )}

      {pendingEmail && (
        <form
          onSubmit={keep(confirm)}
          className="rounded-[10px] bg-admin-input-bg px-3.5 py-3"
        >
          <input type="hidden" name="email" value={pendingEmail} />
          <p className="text-[12.5px] text-admin-text">
            Enviamos um código para{" "}
            <strong>
              {requested.status === "code-sent" ? requested.to : pendingEmail}
            </strong>
            . Informe-o para confirmar o novo e-mail.
          </p>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              placeholder="000 000"
              required
              aria-label="Código enviado ao novo e-mail"
              className={`${FIELD} w-40 text-center tracking-[0.3em]`}
            />
            <button
              type="submit"
              disabled={confirming}
              className="btn btn-admin-primary btn-md"
            >
              {confirming ? "Conferindo..." : "Confirmar"}
            </button>
          </div>
          {confirmed.status === "error" && (
            <p
              role="alert"
              className="mt-2 text-[12.5px] font-semibold text-admin-error-text"
            >
              {confirmed.message}
            </p>
          )}
        </form>
      )}

      <form
        onSubmit={keep(forget)}
        className="border-t border-admin-border pt-3"
      >
        <button
          type="submit"
          disabled={forgetting}
          className="text-[12.5px] font-semibold text-admin-muted underline hover:text-admin-primary"
        >
          {forgetting
            ? "Aplicando..."
            : "Pedir o código de novo nos meus computadores salvos"}
        </button>
      </form>
    </section>
  );
}
