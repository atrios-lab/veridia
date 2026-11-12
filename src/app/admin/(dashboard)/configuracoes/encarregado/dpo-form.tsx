"use client";

import { useActionState } from "react";
import type { Tenant } from "@/core/tenant/schema.ts";
import { AdminIcon } from "../../../_components/icon.tsx";
import { Button } from "../../../_ui/button.tsx";
import { Input } from "../../../_ui/input.tsx";
import { Label } from "../../../_ui/label.tsx";
import { type DpoState, saveDpo } from "./actions.ts";

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
      <Label htmlFor={name} className="mb-1.5">
        {label}
      </Label>
      <Input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />
      {error && (
        <p id={errorId} className="mt-1.5 text-sm text-destructive">
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
      <h2 className="text-lg font-semibold text-foreground">
        Encarregado de Dados (DPO)
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
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
            Encarregado atualizado. Já reflete no site.
          </output>
        )}
      </div>
    </form>
  );
}
