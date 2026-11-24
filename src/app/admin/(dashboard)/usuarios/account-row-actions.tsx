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
import { Button, buttonVariants } from "../../_ui/button.tsx";
import { Input } from "../../_ui/input.tsx";
import {
  type AccountActionState,
  createPasswordResetLink,
  deactivateAccount,
  deleteAccount,
  reactivateAccount,
  resendInvite,
  triggerPasswordReset,
  undeleteAccount,
} from "./actions.ts";
import {
  type AccountSummary,
  UpdateAccountAction,
} from "./update-account-dialog.tsx";

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
        <h2 id={headingId} className="text-lg font-semibold text-foreground">
          Link de nova senha
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Entregue este link à pessoa. Ele vale 48 horas, só funciona uma vez e
          substitui qualquer link anterior desta conta.
        </p>
        <Input
          ref={field}
          readOnly
          value={url}
          aria-label="Link de nova senha"
          onFocus={(event) => event.currentTarget.select()}
          className="mt-3"
        />
      </div>
      <div className={DIALOG_FOOTER}>
        <Button type="button" onClick={onDone} variant="outline">
          Fechar
        </Button>
        <Button
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
        >
          Copiar link
        </Button>
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
        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={pending || issuing}
        >
          {active
            ? pending
              ? "Enviando…"
              : "Nova senha"
            : pending
              ? "Reenviando…"
              : "Reenviar convite"}
        </Button>
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
      trigger="Desativar"
      triggerClassName={buttonVariants({ variant: "outline", size: "sm" })}
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
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "Reativando…" : "Reativar acesso"}
      </Button>
    </form>
  );
}

/**
 * "Excluir" (decision of 24/11/2026): takes the account out of the list and
 * turns its access off. The row stays in the database, so every act keeps
 * its author, and "Desfazer exclusão" brings it back.
 */
function DeleteAction({ name, userId }: { name: string; userId: string }) {
  // O aviso sai daqui, e não de um efeito sobre `state`: dar certo significa
  // que a linha some da lista, e o efeito morre com o componente antes de
  // rodar. `toast` publica num Toaster que vive acima desta árvore, então a
  // mensagem sobrevive ao desmonte.
  const [state, formAction, pending] = useActionState<
    AccountActionState,
    FormData
  >(async (previous, formData) => {
    const result = await deleteAccount(previous, formData);
    if (result.status === "sent") {
      toast.success("Conta excluída. Dá para desfazer em Contas excluídas.");
    }
    return result;
  }, IDLE_ACCOUNT_ACTION_STATE);

  return (
    <ConfirmAction
      action={formAction}
      pending={pending}
      error={state.status === "error" ? state.message : null}
      trigger="Excluir"
      question={`Excluir a conta de ${name}?`}
      consequence="A conta sai da lista e perde o acesso ao painel agora. Nada é apagado: os atos continuam com o nome da pessoa, e dá para desfazer em Contas excluídas."
      confirmLabel="Excluir conta"
      pendingLabel="Excluindo…"
    >
      <input type="hidden" name="userId" value={userId} />
    </ConfirmAction>
  );
}

/** "Desfazer exclusão": back to the list, still without access. */
export function UndeleteAction({ userId }: { userId: string }) {
  const [, formAction, pending] = useActionState<AccountActionState, FormData>(
    async (previous, formData) => {
      const result = await undeleteAccount(previous, formData);
      if (result.status === "sent") {
        toast.success(
          "A conta voltou para a lista, sem acesso. Use Reativar acesso para ela entrar de novo.",
        );
      }
      if (result.status === "error") toast.error(result.message);
      return result;
    },
    IDLE_ACCOUNT_ACTION_STATE,
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="userId" value={userId} />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "Desfazendo…" : "Desfazer exclusão"}
      </Button>
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
  if (disabled) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <ReactivateAction userId={account.id} />
        {!isSelf && <DeleteAction name={account.name} userId={account.id} />}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {/* Offered on every row, the session's own included: correcting your
          own name is legitimate, and the one edit that could lock the office
          out, demoting the last Registrador, is refused by the server. */}
      <UpdateAccountAction account={account} />
      <KeyAction userId={account.id} active={active} />
      {/* Own row never offers either of these: the server refuses them too,
          this is only the courtesy of not showing a button that would just
          come back as an error. */}
      {!isSelf && (
        <>
          <DeactivateAction userId={account.id} />
          <DeleteAction name={account.name} userId={account.id} />
        </>
      )}
    </div>
  );
}
