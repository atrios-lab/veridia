"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "../../_components/confirm-action.tsx";
import {
  type AccountActionState,
  deactivateAccount,
  reactivateAccount,
  resendInvite,
  triggerPasswordReset,
} from "./actions.ts";

const BUTTON_CLASS = "btn btn-admin-secondary btn-sm";
// A "use server" file may only export async functions, so this plain object
// lives here instead of next to AccountActionState in actions.ts.
const IDLE_ACCOUNT_ACTION_STATE: AccountActionState = { status: "idle" };

/**
 * The "Nova senha" / "Reenviar convite" button for one row of the Contas do
 * painel table. A secondary action on a list, not the screen's main
 * submission, so its feedback is a toast (see admin/layout.tsx's Toaster),
 * not a full-page state: same posture as Identidade Visual's "Publicado.".
 */
function KeyAction({ userId, active }: { userId: string; active: boolean }) {
  const action = active ? triggerPasswordReset : resendInvite;
  const [state, formAction, pending] = useActionState<
    AccountActionState,
    FormData
  >(action, IDLE_ACCOUNT_ACTION_STATE);

  useEffect(() => {
    if (state.status === "sent") {
      toast.success(
        active ? "Link de nova senha enviado." : "Convite reenviado.",
      );
    }
    if (state.status === "error") {
      toast.error(state.message);
    }
  }, [state, active]);

  return (
    <form action={formAction}>
      <input type="hidden" name="userId" value={userId} />
      <button type="submit" disabled={pending} className={BUTTON_CLASS}>
        {active
          ? pending
            ? "Enviando…"
            : "Nova senha"
          : pending
            ? "Reenviando…"
            : "Reenviar convite"}
      </button>
    </form>
  );
}

/**
 * "Desativar acesso": turns access off for someone who left, so it goes
 * through the same confirm-modal pattern as every other irreversible-feeling
 * action in the panel, not a bare button.
 */
function DeactivateAction({ userId }: { userId: string }) {
  const [state, formAction, pending] = useActionState<
    AccountActionState,
    FormData
  >(deactivateAccount, IDLE_ACCOUNT_ACTION_STATE);

  useEffect(() => {
    if (state.status === "sent") toast.success("Acesso desativado.");
  }, [state]);

  return (
    <ConfirmAction
      action={formAction}
      pending={pending}
      error={state.status === "error" ? state.message : null}
      trigger="Desativar acesso"
      question="Desativar o acesso desta conta?"
      consequence="A pessoa deixa de conseguir entrar no painel agora, mas a conta continua na lista e pode ser reativada depois."
      confirmLabel="Desativar acesso"
      pendingLabel="Desativando…"
    >
      <input type="hidden" name="userId" value={userId} />
    </ConfirmAction>
  );
}

function ReactivateAction({ userId }: { userId: string }) {
  const [state, formAction, pending] = useActionState<
    AccountActionState,
    FormData
  >(reactivateAccount, IDLE_ACCOUNT_ACTION_STATE);

  useEffect(() => {
    if (state.status === "sent") toast.success("Acesso reativado.");
    if (state.status === "error") toast.error(state.message);
  }, [state]);

  return (
    <form action={formAction}>
      <input type="hidden" name="userId" value={userId} />
      <button type="submit" disabled={pending} className={BUTTON_CLASS}>
        {pending ? "Reativando…" : "Reativar acesso"}
      </button>
    </form>
  );
}

export function AccountRowActions({
  userId,
  active,
  disabled,
  isSelf,
}: {
  userId: string;
  active: boolean;
  disabled: boolean;
  isSelf: boolean;
}) {
  if (disabled) return <ReactivateAction userId={userId} />;

  return (
    <div className="flex items-center gap-2">
      <KeyAction userId={userId} active={active} />
      {/* Own row never offers this: see design.md, the server refuses it
          too, this is only the courtesy of not showing a button that would
          just come back as an error. */}
      {!isSelf && <DeactivateAction userId={userId} />}
    </div>
  );
}
