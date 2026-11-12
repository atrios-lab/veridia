"use client";

import { useActionState } from "react";
import type { Tenant } from "@/core/tenant/schema.ts";
import { AdminIcon } from "../../_components/icon.tsx";
import { Button } from "../../_ui/button.tsx";
import { FieldError, FieldLabel, Field as UiField } from "../../_ui/field.tsx";
import { Input } from "../../_ui/input.tsx";
import { type OfficeContactState, saveOfficeContact } from "./actions.ts";

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
    <UiField className="gap-1.5" data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...input}
      />
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </UiField>
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
      <h2 className="text-lg font-semibold text-foreground">
        Atendimento e contato
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Aparecem no site: no topo da home, na página de contato e no rodapé.
      </p>

      <div className="mt-4.5">
        <Field
          label="Horário de atendimento"
          name="openingHours"
          defaultValue={sent?.openingHours ?? tenant.openingHours}
          error={fieldErrors.openingHours}
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          A frase que o cidadão lê. As horas abaixo são as que o site usa para
          calcular: mantenha as duas dizendo a mesma coisa.
        </p>
      </div>
      <div className="mt-3.5 grid grid-cols-2 gap-3.5 md:max-w-80">
        <Field
          label="Abre às"
          name="startHour"
          type="number"
          min={0}
          max={23}
          inputMode="numeric"
          defaultValue={
            sent?.startHour ?? String(tenant.counterHours.startHour)
          }
          error={fieldErrors.startHour}
        />
        <Field
          label="Fecha às"
          name="endHour"
          type="number"
          min={1}
          max={24}
          inputMode="numeric"
          defaultValue={sent?.endHour ?? String(tenant.counterHours.endHour)}
          error={fieldErrors.endHour}
        />
      </div>
      <div className="mt-3.5 grid grid-cols-2 gap-3.5 md:max-w-80">
        <Field
          label="Intervalo, das"
          name="breakStart"
          type="time"
          defaultValue={
            sent?.breakStart ?? tenant.counterHours.lunchBreak?.start ?? ""
          }
          error={fieldErrors.breakStart}
        />
        <Field
          label="às"
          name="breakEnd"
          type="time"
          defaultValue={
            sent?.breakEnd ?? tenant.counterHours.lunchBreak?.end ?? ""
          }
          error={fieldErrors.breakEnd}
        />
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        Opcional. Preencha se o balcão fecha para o almoço: nesse horário o site
        mostra "Em intervalo" e o chat não abre. Deixe os dois em branco se o
        atendimento é corrido.
      </p>
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
          className="mt-4 rounded-lg border border-destructive/40 bg-destructive-soft px-4 py-3 text-sm font-medium text-destructive"
        >
          {state.message}
        </p>
      )}

      <div className="mt-4.5 flex items-center gap-3.5">
        <Button type="submit" disabled={pending} size="lg">
          {pending ? "Salvando…" : "Salvar"}
        </Button>
        {state.status === "saved" && (
          <output className="flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1.5 text-xs font-medium text-success-text">
            <AdminIcon name="check" className="h-3.5 w-3.5" strokeWidth={2.4} />
            Salvo. Já está valendo no site.
          </output>
        )}
      </div>
    </form>
  );
}
