"use client";

import { useActionState } from "react";
import type { Tenant } from "@/core/tenant/schema.ts";
import { AdminIcon } from "../../../_components/icon.tsx";
import { type DpoState, saveDpo } from "./actions.ts";

const FIELD_CLASS =
  "w-full rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3.5 py-2.5 text-[13.5px] text-admin-text outline-none focus:border-admin-primary-soft";
const ERROR_FIELD_CLASS =
  "w-full rounded-[9px] border border-admin-error-border bg-admin-error-input-bg px-3.5 py-2.5 text-[13.5px] text-admin-text outline-none focus:border-admin-error-text";
const LABEL_CLASS = "mb-1.5 block text-xs font-bold text-admin-primary";

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  error,
}: {
  label: string;
  name: string;
  defaultValue: string;
  type?: string;
  error?: string;
}) {
  const errorId = `${name}-erro`;
  return (
    <div>
      <label className={LABEL_CLASS} htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={error ? ERROR_FIELD_CLASS : FIELD_CLASS}
      />
      {error && (
        <p
          id={errorId}
          className="mt-1.5 text-xs font-semibold text-admin-error-text"
        >
          {error}
        </p>
      )}
    </div>
  );
}

export function DpoForm({ tenant }: { tenant: Tenant }) {
  const [state, formAction, pending] = useActionState<DpoState, FormData>(
    saveDpo,
    { status: "idle" },
  );
  const fieldErrors = state.status === "error" ? state.fieldErrors : {};
  const sent = state.status === "error" ? state.values : undefined;

  return (
    <form action={formAction}>
      <h2 className="font-serif text-[17px] font-semibold text-admin-primary">
        Encarregado de Dados (DPO)
      </h2>
      <p className="mt-1 text-[12.5px] text-admin-muted">
        Aparece publicamente na área LGPD do site, por exigência da Lei
        13.709/2018 (art. 41, §3º). É para este e-mail que o cidadão escreve
        quando o assunto é dado pessoal.
      </p>

      <div className="mt-4.5 grid grid-cols-1 gap-3.5 md:grid-cols-2">
        <Field
          label="Nome"
          name="name"
          defaultValue={sent?.name ?? tenant.dpo.name}
          error={fieldErrors.name}
        />
        <Field
          label="E-mail de contato"
          name="email"
          type="email"
          defaultValue={sent?.email ?? tenant.dpo.email}
          error={fieldErrors.email}
        />
      </div>

      {state.status === "error" && (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-admin-error-bg px-3.5 py-2.5 text-sm font-semibold text-admin-error-text"
        >
          {state.message}
        </p>
      )}

      <div className="mt-4.5 flex items-center gap-3.5">
        <button
          type="submit"
          disabled={pending}
          className="rounded-[9px] bg-admin-primary-soft px-5 py-2.5 text-[13.5px] font-bold text-white disabled:opacity-70"
        >
          {pending ? "Salvando…" : "Salvar"}
        </button>
        {state.status === "saved" && (
          <output className="flex items-center gap-1.5 rounded-full bg-admin-success-bg px-3 py-1.5 text-[12.5px] font-semibold text-admin-success-text">
            <AdminIcon name="check" className="h-3.5 w-3.5" strokeWidth={2.4} />
            Encarregado atualizado. Já reflete no site.
          </output>
        )}
      </div>
    </form>
  );
}
