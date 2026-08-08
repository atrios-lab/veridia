"use client";

import { useActionState } from "react";
import { ROLES } from "@/core/auth/roles.ts";
import { AdminIcon } from "../../_components/icon.tsx";
import { ROLE_LABELS } from "../../_components/role-labels.ts";
import { type CreateAccountState, createUser } from "./actions.ts";

const FIELD_CLASS =
  "w-full rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3.5 py-2.5 text-[13.5px] text-admin-text outline-none focus:border-admin-primary-soft";
const ERROR_FIELD_CLASS =
  "w-full rounded-[9px] border border-admin-error-border bg-admin-error-input-bg px-3.5 py-2.5 text-[13.5px] text-admin-text outline-none focus:border-admin-error-text";
const LABEL_CLASS = "mb-1.5 block text-xs font-bold text-admin-primary";

export function CreateAccountForm() {
  const [state, formAction, pending] = useActionState<
    CreateAccountState,
    FormData
  >(createUser, { status: "idle" });
  const fieldErrors = state.status === "error" ? state.fieldErrors : {};
  // Same reasoning as OfficeContactForm: React resets an uncontrolled form
  // once the action resolves, so a failed submit echoes back what was typed
  // rather than losing the two fields that were actually fine.
  const sent = state.status === "error" ? state.values : undefined;

  return (
    <div className="rounded-2xl border border-admin-active-border bg-admin-card p-5.5">
      <h2 className="font-serif text-base font-semibold text-admin-primary">
        Criar conta
      </h2>
      <p className="mt-0.5 text-[11.5px] text-admin-muted">
        A pessoa recebe por e-mail o link para criar a própria senha.
      </p>

      <form action={formAction} className="mt-4 flex flex-col gap-3.5">
        <div>
          <label className={LABEL_CLASS} htmlFor="name">
            Nome
          </label>
          <input
            id="name"
            name="name"
            type="text"
            defaultValue={sent?.name}
            aria-invalid={fieldErrors.name ? true : undefined}
            className={fieldErrors.name ? ERROR_FIELD_CLASS : FIELD_CLASS}
          />
          {fieldErrors.name && (
            <p className="mt-1.5 text-xs font-semibold text-admin-error-text">
              {fieldErrors.name}
            </p>
          )}
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="email">
            E-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            defaultValue={sent?.email}
            aria-invalid={fieldErrors.email ? true : undefined}
            className={fieldErrors.email ? ERROR_FIELD_CLASS : FIELD_CLASS}
          />
          {fieldErrors.email && (
            <p className="mt-1.5 text-xs font-semibold text-admin-error-text">
              {fieldErrors.email}
            </p>
          )}
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="role">
            Papel
          </label>
          <select
            id="role"
            name="role"
            defaultValue={sent?.role ?? "staff"}
            className={fieldErrors.role ? ERROR_FIELD_CLASS : FIELD_CLASS}
          >
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
          {fieldErrors.role && (
            <p className="mt-1.5 text-xs font-semibold text-admin-error-text">
              {fieldErrors.role}
            </p>
          )}
        </div>

        {state.status === "error" && (
          <p
            role="alert"
            className="rounded-lg bg-admin-error-bg px-3.5 py-2.5 text-sm font-semibold text-admin-error-text"
          >
            {state.message}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded-[9px] bg-admin-primary-soft px-5 py-2.5 text-[13.5px] font-bold text-white disabled:opacity-70"
        >
          {pending ? "Criando…" : "Criar conta"}
        </button>

        {state.status === "created" && (
          <output className="flex items-center gap-1.5 rounded-full bg-admin-success-bg px-3 py-1.5 text-[12.5px] font-semibold text-admin-success-text">
            <AdminIcon name="check" className="h-3.5 w-3.5" strokeWidth={2.4} />
            Conta criada — e-mail enviado.
          </output>
        )}
      </form>

      <p className="mt-3.5 border-t border-admin-border pt-3 text-[11.5px] leading-relaxed text-admin-muted">
        Operador usa o painel. Registrador usa e também administra contas.
      </p>
    </div>
  );
}
