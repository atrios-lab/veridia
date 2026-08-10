"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import {
  type AccountActionState,
  IDLE_ACCOUNT_ACTION_STATE,
  resendInvite,
  triggerPasswordReset,
} from "./actions.ts";

const BUTTON_CLASS = "btn btn-admin-secondary btn-sm";

/**
 * The "Nova senha" / "Reenviar convite" button for one row of the Contas do
 * painel table. A secondary action on a list, not the screen's main
 * submission, so its feedback is a toast (see admin/layout.tsx's Toaster),
 * not a full-page state — same posture as Identidade Visual's "Publicado.".
 */
export function AccountRowActions({
  userId,
  active,
}: {
  userId: string;
  active: boolean;
}) {
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
