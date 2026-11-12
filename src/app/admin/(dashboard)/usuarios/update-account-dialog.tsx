"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { PANEL_ROLES } from "@/core/auth/roles.ts";
import { AdminDialog, DIALOG_FOOTER } from "../../_components/dialog.tsx";
import { ROLE_LABELS } from "../../_components/role-labels.ts";
import { Button } from "../../_ui/button.tsx";
import { Input } from "../../_ui/input.tsx";
import { Label } from "../../_ui/label.tsx";
import { NativeSelect } from "../../_ui/native-select.tsx";
import { type UpdateAccountState, updateAccount } from "./actions.ts";

const IDLE: UpdateAccountState = { status: "idle" };

export interface AccountSummary {
  id: string;
  name: string;
  email: string;
  role: string;
}

/**
 * "Atualizar": corrects the name, the e-mail and the role of an account
 * that already exists. Name and role are written on save; the e-mail is
 * only *asked for* here, and becomes the login when whoever reaches the new
 * address opens the link sent to it.
 */
function UpdateAccountForm({
  account,
  onDone,
}: {
  account: AccountSummary;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState<
    UpdateAccountState,
    FormData
  >(updateAccount, IDLE);
  const headingId = useId();
  const fieldErrors = state.status === "error" ? state.fieldErrors : {};
  const sent = state.status === "error" ? state.values : undefined;

  useEffect(() => {
    if (state.status === "saved") {
      toast.success("Conta atualizada.");
      onDone();
    }
    if (state.status === "saved-pending-email") {
      toast.success(
        `Conta atualizada. Falta ${state.email} confirmar o novo e-mail.`,
      );
      onDone();
    }
  }, [state, onDone]);

  return (
    <AdminDialog
      labelledBy={headingId}
      onClose={() => {
        if (!pending) onDone();
      }}
    >
      <form action={formAction}>
        <div className="dialog-body flex flex-col gap-3.5">
          <div>
            <h2
              id={headingId}
              className="text-lg font-semibold text-foreground"
            >
              Atualizar conta
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {account.name} · {account.email}
            </p>
          </div>

          <input type="hidden" name="userId" value={account.id} />

          <div>
            <Label htmlFor="update-name" className="mb-1.5">
              Nome
            </Label>
            <Input
              id="update-name"
              name="name"
              type="text"
              defaultValue={sent?.name ?? account.name}
              aria-invalid={fieldErrors.name ? true : undefined}
            />
            {fieldErrors.name && (
              <p className="mt-1.5 text-sm text-destructive">
                {fieldErrors.name}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="update-email" className="mb-1.5">
              E-mail{" "}
              <span className="font-normal text-muted-foreground">
                (também é o login)
              </span>
            </Label>
            <Input
              id="update-email"
              name="email"
              type="email"
              defaultValue={sent?.email ?? account.email}
              aria-invalid={fieldErrors.email ? true : undefined}
            />
            {fieldErrors.email && (
              <p className="mt-1.5 text-sm text-destructive">
                {fieldErrors.email}
              </p>
            )}
            <p className="mt-1.5 text-xs text-muted-foreground">
              Ao mudar, enviamos um link de confirmação ao novo e-mail. O login
              antigo vale até a pessoa confirmar.
            </p>
          </div>

          <div>
            <Label htmlFor="update-role" className="mb-1.5">
              Papel
            </Label>
            <NativeSelect
              id="update-role"
              name="role"
              defaultValue={sent?.role ?? account.role}
              className="w-full"
            >
              {PANEL_ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </NativeSelect>
            {/* The approved design says "vale no próximo login". It does
                not: getSession() reads the database on every request, the
                same property that makes "Desativar acesso" cut a session
                off at once. Promising otherwise would leave a demoted
                operator watching buttons disappear with no explanation. */}
            <p className="mt-1.5 text-xs text-muted-foreground">
              A mudança de papel vale imediatamente, sem precisar sair e entrar
              de novo.
            </p>
          </div>

          {state.status === "error" && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/40 bg-destructive-soft px-4 py-3 text-sm font-medium text-destructive"
            >
              {state.message}
            </p>
          )}
        </div>

        <div className={DIALOG_FOOTER}>
          <Button
            type="button"
            onClick={onDone}
            disabled={pending}
            variant="outline"
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando…" : "Salvar alterações"}
          </Button>
        </div>
      </form>
    </AdminDialog>
  );
}

export function UpdateAccountAction({ account }: { account: AccountSummary }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        variant="outline"
        size="sm"
      >
        Atualizar
      </Button>
      {/* Mounted only while open, so each opening starts from the account's
          current values instead of whatever the last edit left behind. */}
      {open && (
        <UpdateAccountForm account={account} onDone={() => setOpen(false)} />
      )}
    </>
  );
}
