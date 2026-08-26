"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { PANEL_ROLES } from "@/core/auth/roles.ts";
import { AdminDialog, DIALOG_FOOTER } from "../../_components/dialog.tsx";
import { ROLE_LABELS } from "../../_components/role-labels.ts";
import { type UpdateAccountState, updateAccount } from "./actions.ts";

const FIELD_CLASS =
  "w-full rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3.5 py-2.5 text-[13.5px] text-admin-text outline-none focus:border-admin-primary-soft";
const ERROR_FIELD_CLASS =
  "w-full rounded-[9px] border border-admin-error-border bg-admin-error-input-bg px-3.5 py-2.5 text-[13.5px] text-admin-text outline-none focus:border-admin-error-text";
const LABEL_CLASS = "mb-1.5 block text-xs font-bold text-admin-primary";
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
              className="font-serif text-[18px] font-semibold text-admin-primary"
            >
              Atualizar conta
            </h2>
            <p className="mt-0.5 text-[11.5px] text-admin-muted">
              {account.name} · {account.email}
            </p>
          </div>

          <input type="hidden" name="userId" value={account.id} />

          <div>
            <label className={LABEL_CLASS} htmlFor="update-name">
              Nome
            </label>
            <input
              id="update-name"
              name="name"
              type="text"
              defaultValue={sent?.name ?? account.name}
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
            <label className={LABEL_CLASS} htmlFor="update-email">
              E-mail{" "}
              <span className="font-normal text-admin-muted">
                (também é o login)
              </span>
            </label>
            <input
              id="update-email"
              name="email"
              type="email"
              defaultValue={sent?.email ?? account.email}
              aria-invalid={fieldErrors.email ? true : undefined}
              className={fieldErrors.email ? ERROR_FIELD_CLASS : FIELD_CLASS}
            />
            {fieldErrors.email && (
              <p className="mt-1.5 text-xs font-semibold text-admin-error-text">
                {fieldErrors.email}
              </p>
            )}
            <p className="mt-1.5 text-[11.5px] text-admin-muted">
              Ao mudar, enviamos um link de confirmação ao novo e-mail. O login
              antigo vale até a pessoa confirmar.
            </p>
          </div>

          <div>
            <label className={LABEL_CLASS} htmlFor="update-role">
              Papel
            </label>
            <select
              id="update-role"
              name="role"
              defaultValue={sent?.role ?? account.role}
              className={fieldErrors.role ? ERROR_FIELD_CLASS : FIELD_CLASS}
            >
              {PANEL_ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
            {/* The approved design says "vale no próximo login". It does
                not: getSession() reads the database on every request, the
                same property that makes "Desativar acesso" cut a session
                off at once. Promising otherwise would leave a demoted
                operator watching buttons disappear with no explanation. */}
            <p className="mt-1.5 text-[11.5px] text-admin-muted">
              A mudança de papel vale imediatamente, sem precisar sair e entrar
              de novo.
            </p>
          </div>

          {state.status === "error" && (
            <p
              role="alert"
              className="rounded-lg bg-admin-error-bg px-3.5 py-2.5 text-sm font-semibold text-admin-error-text"
            >
              {state.message}
            </p>
          )}
        </div>

        <div className={DIALOG_FOOTER}>
          <button
            type="button"
            onClick={onDone}
            disabled={pending}
            className="btn btn-admin-secondary btn-md"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={pending}
            className="btn btn-admin-primary btn-md"
          >
            {pending ? "Salvando…" : "Salvar alterações"}
          </button>
        </div>
      </form>
    </AdminDialog>
  );
}

export function UpdateAccountAction({ account }: { account: AccountSummary }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-admin-secondary btn-sm"
      >
        Atualizar
      </button>
      {/* Mounted only while open, so each opening starts from the account's
          current values instead of whatever the last edit left behind. */}
      {open && (
        <UpdateAccountForm account={account} onDone={() => setOpen(false)} />
      )}
    </>
  );
}
