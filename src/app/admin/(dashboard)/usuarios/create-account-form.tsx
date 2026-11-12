"use client";

import { useActionState } from "react";
import { PANEL_ROLES } from "@/core/auth/roles.ts";
import { AdminIcon } from "../../_components/icon.tsx";
import { ROLE_LABELS } from "../../_components/role-labels.ts";
import { Button } from "../../_ui/button.tsx";
import { Input } from "../../_ui/input.tsx";
import { Label } from "../../_ui/label.tsx";
import { NativeSelect } from "../../_ui/native-select.tsx";
import { type CreateAccountState, createUser } from "./actions.ts";

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
    <div className="rounded-xl border bg-card p-6">
      <h2 className="text-base font-semibold text-foreground">Criar conta</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">
        A pessoa recebe por e-mail o link para criar a própria senha.
      </p>

      <form action={formAction} className="mt-4 flex flex-col gap-3.5">
        <div>
          <Label htmlFor="name" className="mb-1.5">
            Nome
          </Label>
          <Input
            id="name"
            name="name"
            type="text"
            defaultValue={sent?.name}
            aria-invalid={fieldErrors.name ? true : undefined}
          />
          {fieldErrors.name && (
            <p className="mt-1.5 text-sm text-destructive">
              {fieldErrors.name}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="email" className="mb-1.5">
            E-mail
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={sent?.email}
            aria-invalid={fieldErrors.email ? true : undefined}
          />
          {fieldErrors.email && (
            <p className="mt-1.5 text-sm text-destructive">
              {fieldErrors.email}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="role" className="mb-1.5">
            Papel
          </Label>
          <NativeSelect
            id="role"
            name="role"
            defaultValue={sent?.role ?? "staff"}
            className="w-full"
          >
            {PANEL_ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </NativeSelect>
          {fieldErrors.role && (
            <p className="mt-1.5 text-sm text-destructive">
              {fieldErrors.role}
            </p>
          )}
        </div>

        {state.status === "error" && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive-soft px-4 py-3 text-sm font-medium text-destructive"
          >
            {state.message}
          </p>
        )}

        <Button type="submit" disabled={pending} size="lg">
          {pending ? "Criando…" : "Criar conta"}
        </Button>

        {state.status === "created" && (
          <output className="flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1.5 text-xs font-medium text-success-text">
            <AdminIcon name="check" className="h-3.5 w-3.5" strokeWidth={2.4} />
            Conta criada. E-mail enviado.
          </output>
        )}
      </form>

      <p className="mt-3.5 border-t pt-3 text-xs leading-relaxed text-muted-foreground">
        O Tabelião/Registrador cadastra as pessoas, define o que cada cargo faz
        e vê (Configurações › Perfis e permissões) e acompanha a auditoria.
      </p>
    </div>
  );
}
