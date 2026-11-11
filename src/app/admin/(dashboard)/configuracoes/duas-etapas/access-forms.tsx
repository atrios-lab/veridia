"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { type AccessState, forgetComputers, saveCodeEmail } from "./actions.ts";

const IDLE: AccessState = { status: "idle" };

function submitKeeping(dispatch: (data: FormData) => void) {
  return (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => dispatch(data));
  };
}

export function AccountAccessRow({
  userId,
  name,
  role,
  accountEmail,
  codeEmail,
  sendsTo,
}: {
  userId: string;
  name: string;
  role: string;
  accountEmail: string;
  codeEmail: string;
  sendsTo: string;
}) {
  const [email, setEmail] = useState(codeEmail);
  const [saved, save, saving] = useActionState(saveCodeEmail, IDLE);
  const [forgot, forget, forgetting] = useActionState(forgetComputers, IDLE);
  useEffect(() => {
    if (saved.status === "saved") toast.success(saved.message);
  }, [saved]);
  useEffect(() => {
    if (forgot.status === "saved") toast.success(forgot.message);
  }, [forgot]);
  const error =
    saved.status === "error"
      ? saved.message
      : forgot.status === "error"
        ? forgot.message
        : null;

  return (
    <section className="rounded-[14px] border border-admin-border bg-admin-card px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-serif text-[16px] font-semibold text-admin-primary">
          {name}
        </h3>
        <span className="text-[11.5px] text-admin-muted">
          {role === "admin"
            ? "Administrador"
            : role === "staff"
              ? "Equipe"
              : "Treinamento"}{" "}
          · conta {accountEmail}
        </span>
      </div>
      <p className="mt-1 text-[12.5px] text-admin-text">
        O código vai para <strong>{sendsTo}</strong>.
      </p>
      <form
        onSubmit={submitKeeping(save)}
        className="mt-3 flex flex-wrap items-end gap-2"
      >
        <input type="hidden" name="userId" value={userId} />
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-bold text-admin-primary">
          E-mail de verificação
          <input
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={`${accountEmail} (o da conta)`}
            className="rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3.5 py-2.5 text-[13.5px] font-normal text-admin-text outline-none focus:border-admin-primary-soft"
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="btn btn-admin-primary btn-md"
        >
          {saving ? "Salvando..." : "Salvar"}
        </button>
        {codeEmail && (
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              setEmail("");
              const data = new FormData();
              data.set("userId", userId);
              data.set("email", "");
              startTransition(() => save(data));
            }}
            className="btn btn-admin-secondary btn-md"
          >
            Apagar
          </button>
        )}
      </form>
      <form onSubmit={submitKeeping(forget)} className="mt-2.5">
        <input type="hidden" name="userId" value={userId} />
        <button
          type="submit"
          disabled={forgetting}
          className="text-[12px] font-semibold text-admin-muted underline hover:text-admin-primary"
        >
          {forgetting
            ? "Aplicando..."
            : "Pedir o código de novo nos dispositivos salvos"}
        </button>
      </form>
      {error && (
        <p
          role="alert"
          className="mt-2 text-[12.5px] font-semibold text-admin-error-text"
        >
          {error}
        </p>
      )}
    </section>
  );
}
