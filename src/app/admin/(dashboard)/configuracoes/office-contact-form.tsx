"use client";

import { useActionState } from "react";
import type { Tenant } from "@/core/tenant/schema.ts";
import { AdminIcon } from "../../_components/icon.tsx";
import { type OfficeContactState, saveOfficeContact } from "./actions.ts";

const FIELD_CLASS =
  "w-full rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3.5 py-2.5 text-[13.5px] text-admin-text outline-none focus:border-admin-primary-soft";
const ERROR_FIELD_CLASS =
  "w-full rounded-[9px] border border-admin-error-border bg-admin-error-input-bg px-3.5 py-2.5 text-[13.5px] text-admin-text outline-none focus:border-admin-error-text";
const LABEL_CLASS = "mb-1.5 block text-xs font-bold text-admin-primary";

export function Field({
  label,
  name,
  defaultValue,
  type = "text",
  error,
  ...input
}: {
  label: string;
  name: string;
  defaultValue: string;
  type?: string;
  error?: string;
} & Pick<React.ComponentProps<"input">, "min" | "max" | "step" | "inputMode">) {
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
        {...input}
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

export function OfficeContactForm({ tenant }: { tenant: Tenant }) {
  const [state, formAction, pending] = useActionState<
    OfficeContactState,
    FormData
  >(saveOfficeContact, { status: "idle" });
  const fieldErrors = state.status === "error" ? state.fieldErrors : {};

  // React resets an uncontrolled form once the action resolves, so a failed
  // submit would otherwise wipe the three fields that were right. The action
  // echoes back what it received and those become the defaults; on the first
  // render there is nothing to echo and the office's own values stand.
  const sent = state.status === "error" ? state.values : undefined;

  return (
    <form action={formAction}>
      <h2 className="font-serif text-[17px] font-semibold text-admin-primary">
        Atendimento e contato
      </h2>
      <p className="mt-1 text-[12.5px] text-admin-muted">
        Aparecem no site: no topo da home, na página de contato e no rodapé.
      </p>

      <div className="mt-4.5">
        <Field
          label="Horário de atendimento"
          name="openingHours"
          defaultValue={sent?.openingHours ?? tenant.openingHours}
          error={fieldErrors.openingHours}
        />
      </div>
      <div className="mt-3.5 grid grid-cols-1 gap-3.5 md:grid-cols-3">
        <Field
          label="Telefone"
          name="phone"
          defaultValue={sent?.phone ?? tenant.contacts.phone}
          error={fieldErrors.phone}
        />
        <Field
          label="WhatsApp"
          name="whatsapp"
          defaultValue={sent?.whatsapp ?? tenant.contacts.whatsapp}
          error={fieldErrors.whatsapp}
        />
        <Field
          label="E-mail"
          name="email"
          type="email"
          defaultValue={sent?.email ?? tenant.contacts.email}
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
          className="btn btn-admin-primary btn-lg"
        >
          {pending ? "Salvando…" : "Salvar"}
        </button>
        {state.status === "saved" && (
          <output className="flex items-center gap-1.5 rounded-full bg-admin-success-bg px-3 py-1.5 text-[12.5px] font-semibold text-admin-success-text">
            <AdminIcon name="check" className="h-3.5 w-3.5" strokeWidth={2.4} />
            Salvo. Já está valendo no site.
          </output>
        )}
      </div>
    </form>
  );
}
