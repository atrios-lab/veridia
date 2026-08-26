"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import { ConfirmAction } from "../../_components/confirm-action.tsx";
import { AdminDialog, DIALOG_FOOTER } from "../../_components/dialog.tsx";
import {
  type AccountActionState,
  createPasswordResetLink,
  deactivateAccount,
  reactivateAccount,
  resendInvite,
  triggerPasswordReset,
} from "./actions.ts";
import {
  type AccountSummary,
  UpdateAccountAction,
} from "./update-account-dialog.tsx";

const BUTTON_CLASS = "btn btn-admin-secondary btn-sm";
// A "use server" file may only export async functions, so this plain object
// lives here instead of next to AccountActionState in actions.ts.
const IDLE_ACCOUNT_ACTION_STATE: AccountActionState = { status: "idle" };

/**
 * The way back in when the e-mail provider will not deliver: the same link
 * the message would have carried, on screen, for the registrador to hand
 * over by whatever channel does work.
 *
 * The link is shown rather than only copied because a clipboard write can
 * fail silently, and a person who cannot read the link has no way to notice
 * that it never arrived on the clipboard.
 */
function ResetLinkDialog({ url, onDone }: { url: string; onDone: () => void }) {
  const headingId = useId();
  const field = useRef<HTMLInputElement>(null);

  return (
    <AdminDialog labelledBy={headingId} onClose={onDone}>
      <div className="dialog-body">
        <h2
          id={headingId}
          className="font-serif text-[18px] font-semibold text-admin-primary"
        >
          Link de nova senha
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-admin-muted">
          Entregue este link à pessoa. Ele vale 48 horas, só funciona uma vez e
          substitui qualquer link anterior desta conta.
        </p>
        <input
          ref={field}
          readOnly
          value={url}
          aria-label="Link de nova senha"
          onFocus={(event) => event.currentTarget.select()}
          className="mt-3 w-full rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3.5 py-2.5 text-[12.5px] text-admin-text outline-none"
        />
      </div>
      <div className={DIALOG_FOOTER}>
        <button
          type="button"
          onClick={onDone}
          className="btn btn-admin-secondary btn-md"
        >
          Fechar
        </button>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              toast.success("Link copiado.");
            } catch {
              // Denied permission, or no clipboard at all: the link is
              // already on screen, so selecting it is the whole fallback.
              field.current?.focus();
              toast.error("Não deu para copiar. Selecione o link e copie.");
            }
          }}
          className="btn btn-admin-primary btn-md"
        >
          Copiar link
        </button>
      </div>
    </AdminDialog>
  );
}

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
  const [link, setLink] = useState<string | null>(null);
  const [issuing, startIssuing] = useTransition();

  const requestLink = useCallback(() => {
    startIssuing(async () => {
      const data = new FormData();
      data.set("userId", userId);
      const result = await createPasswordResetLink({ status: "idle" }, data);
      if (result.status === "ready") setLink(result.url);
      if (result.status === "error") toast.error(result.message);
    });
  }, [userId]);

  useEffect(() => {
    if (state.status === "sent") {
      toast.success(
        active ? "Link de nova senha enviado." : "Convite reenviado.",
      );
    }
    // The way out rides along with the failure instead of sitting in the
    // row: it is only ever wanted right after an envio that did not land.
    if (state.status === "error") {
      toast.error(state.message, {
        action: { label: "Copiar link", onClick: requestLink },
      });
    }
  }, [state, active, requestLink]);

  return (
    <>
      <form action={formAction}>
        <input type="hidden" name="userId" value={userId} />
        <button
          type="submit"
          disabled={pending || issuing}
          className={BUTTON_CLASS}
        >
          {active
            ? pending
              ? "Enviando…"
              : "Nova senha"
            : pending
              ? "Reenviando…"
              : "Reenviar convite"}
        </button>
      </form>
      {link && <ResetLinkDialog url={link} onDone={() => setLink(null)} />}
    </>
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
  account,
  active,
  disabled,
  isSelf,
}: {
  account: AccountSummary;
  active: boolean;
  disabled: boolean;
  isSelf: boolean;
}) {
  if (disabled) return <ReactivateAction userId={account.id} />;

  return (
    <div className="flex items-center gap-2">
      {/* Offered on every row, the session's own included: correcting your
          own name is legitimate, and the one edit that could lock the office
          out, demoting the last Registrador, is refused by the server. */}
      <UpdateAccountAction account={account} />
      <KeyAction userId={account.id} active={active} />
      {/* Own row never offers this: see design.md, the server refuses it
          too, this is only the courtesy of not showing a button that would
          just come back as an error. */}
      {!isSelf && <DeactivateAction userId={account.id} />}
    </div>
  );
}
