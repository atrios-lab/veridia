"use client";

import { useActionState } from "react";
import { isEmailContact } from "@/core/request/form.ts";
import { ConfirmAction } from "../../../../_components/confirm-action.tsx";
import { Button, buttonVariants } from "../../../../_ui/button.tsx";
import { type ReissueKeyState, reissueKeyAction } from "../actions.ts";

/**
 * The chave de acesso (decision of 13/11/2026). The key on file is never
 * shown: the database keeps only its hash. When the client lost it, or
 * gave a wrong e-mail (corrected first in "Dados do solicitante"), the
 * office issues a new one here: the old one stops working, the new one
 * goes to the e-mail on file with the link that opens the pedido, and is
 * shown once, to print the receipt with the access data for the client.
 * The client can still recover it alone, on the site's consult page.
 */
export function KeySection({
  requestId,
  protocolNumber,
  contact,
  issuedLabel,
}: {
  requestId: string;
  protocolNumber: string;
  contact: string | null;
  issuedLabel: string;
}) {
  const [state, action, pending] = useActionState<ReissueKeyState, FormData>(
    reissueKeyAction,
    { status: "idle" },
  );
  const hasEmail = Boolean(contact) && isEmailContact(contact as string);
  const printHref = `/admin/pedidos/${encodeURIComponent(protocolNumber)}/imprimir`;

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div>
        <h4 className="text-base font-semibold text-foreground">
          Chave de acesso
        </h4>
        <p className="mt-1 text-xs text-muted-foreground">
          Ativa desde {issuedLabel}. O cliente usa junto do protocolo para ver o
          pedido completo.
        </p>
      </div>

      {state.status === "success" ? (
        <div className="flex flex-col gap-2.5 rounded-lg border border-success/30 bg-success-soft p-3">
          <p className="text-xs font-semibold text-success-text">
            Nova chave gerada.{" "}
            {state.sentTo
              ? `Enviada para ${state.sentTo}, com o link que abre o pedido.`
              : "O contato do pedido não é um e-mail: entregue os dados impressos."}{" "}
            A chave anterior deixou de valer.
          </p>
          {state.emailWarning && (
            <p className="text-xs font-semibold text-destructive">
              {state.emailWarning}
            </p>
          )}
          <dl className="grid gap-1.5 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Protocolo</dt>
              <dd className="font-mono font-semibold tracking-wide text-foreground">
                {protocolNumber}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Chave de acesso</dt>
              <dd className="font-mono text-base font-semibold tracking-widest text-foreground">
                {state.accessKey}
              </dd>
            </div>
          </dl>
          <p className="text-xs text-muted-foreground">
            A chave aparece só agora: o sistema guarda apenas uma versão
            cifrada.
          </p>
          <form method="post" action={printHref} target="_blank" rel="noopener">
            <input type="hidden" name="chave" value={state.accessKey} />
            <Button type="submit" variant="outline" size="sm">
              Imprimir os dados de acesso
            </Button>
          </form>
        </div>
      ) : (
        <p className="text-xs leading-relaxed text-foreground">
          {hasEmail
            ? "Se o cliente perdeu a chave ou não recebeu o e-mail, gere uma nova: ela vai para o e-mail do pedido e pode ser impressa aqui. Se o e-mail estiver errado, corrija antes em Dados do solicitante."
            : "O contato deste pedido não é um e-mail: gere uma nova chave para imprimir os dados de acesso, ou corrija o contato em Dados do solicitante para ela ir por e-mail."}
        </p>
      )}

      <ConfirmAction
        action={action}
        pending={pending}
        error={state.status === "error" ? state.message : null}
        trigger={
          hasEmail
            ? "Gerar nova chave e reenviar ao cliente"
            : "Gerar nova chave para imprimir"
        }
        triggerClassName={buttonVariants({ variant: "outline", size: "sm" })}
        className="self-start"
        question="Gerar uma nova chave de acesso?"
        consequence={
          hasEmail
            ? `A chave atual deixa de valer. A nova vai para ${contact}, com o link que abre o pedido, e aparece aqui para imprimir.`
            : "A chave atual deixa de valer. A nova aparece aqui para imprimir e entregar ao cliente."
        }
        confirmLabel="Gerar nova chave"
        pendingLabel="Gerando..."
        justify={false}
      >
        <input type="hidden" name="requestId" value={requestId} />
      </ConfirmAction>
    </div>
  );
}
