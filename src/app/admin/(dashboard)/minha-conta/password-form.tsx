"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { changeOwnPassword, type PasswordState } from "./actions.ts";

const FIELD =
  "w-full rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3.5 py-2.5 text-[13.5px] text-admin-text outline-none focus:border-admin-primary-soft";
const LABEL = "flex flex-col gap-1.5 text-xs font-bold text-admin-primary";

/** Trocar a própria senha: the current one, the new one twice. */
export function PasswordForm({ changed }: { changed: boolean }) {
  const [state, action, pending] = useActionState<PasswordState, FormData>(
    changeOwnPassword,
    { status: "idle" },
  );
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status !== "saved") return;
    toast.success(state.message);
    form.current?.reset();
  }, [state]);

  return (
    <section
      id="senha"
      className="rounded-[14px] border border-admin-border bg-admin-card px-5 py-4"
    >
      <h2 className="font-serif text-[17px] font-semibold text-admin-primary">
        Trocar minha senha
      </h2>
      {changed && (
        <output className="mt-2 block rounded-[10px] bg-admin-success-bg px-3.5 py-2.5 text-[12.5px] font-semibold text-admin-success-text">
          Senha trocada. Nos outros dispositivos, entre de novo com a senha
          nova.
        </output>
      )}
      <p className="mt-1 text-[12.5px] text-admin-muted">
        Informe a senha atual e a nova, com pelo menos 8 caracteres. Os outros
        dispositivos onde você está conectado saem e pedem a senha nova.
      </p>
      <form
        ref={form}
        // Not `action={action}`: React would clear the fields after a wrong
        // current password, and the new one would have to be typed again.
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          startTransition(() => action(data));
        }}
        className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3"
      >
        <label className={LABEL}>
          Senha atual
          <input
            name="atual"
            type="password"
            autoComplete="current-password"
            required
            className={`${FIELD} font-normal`}
          />
        </label>
        <label className={LABEL}>
          Nova senha
          <input
            name="nova"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            className={`${FIELD} font-normal`}
          />
        </label>
        <label className={LABEL}>
          Repita a nova senha
          <input
            name="confirmar"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            className={`${FIELD} font-normal`}
          />
        </label>
        <div className="md:col-span-3">
          <button
            type="submit"
            disabled={pending}
            className="btn btn-admin-primary btn-md"
          >
            {pending ? "Trocando..." : "Trocar senha"}
          </button>
          {state.status === "error" && (
            <p
              role="alert"
              className="mt-2 text-[12.5px] font-semibold text-admin-error-text"
            >
              {state.message}
            </p>
          )}
        </div>
      </form>
    </section>
  );
}
