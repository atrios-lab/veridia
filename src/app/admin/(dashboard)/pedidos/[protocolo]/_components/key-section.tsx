import { isEmailContact } from "@/core/request/form.ts";

/**
 * The chave de acesso is never rendered here, and there is no action on
 * this section any more: the panel cannot produce the key in the clear for
 * a request that already exists (the database holds only its hash), and
 * asking the office to relay a new one by hand is exactly the habit this
 * section used to invite. Recovering a lost key is the citizen's own path
 * now, `recoverAccessKeyAction` on the consult page (`/protocolo`), so this
 * section only says that, and, when the contact on file cannot receive it,
 * what the operator can still do about it.
 */
export function KeySection({
  contact,
  issuedLabel,
}: {
  contact: string | null;
  issuedLabel: string;
}) {
  const hasEmail = Boolean(contact) && isEmailContact(contact as string);

  return (
    <div className="rounded-[14px] border border-admin-border bg-admin-card p-4.5">
      <h4 className="font-serif text-[15.5px] font-semibold text-admin-primary">
        Chave de acesso
      </h4>
      <p className="mt-1 text-[12px] text-admin-muted">
        Ativa desde {issuedLabel}. O cidadão usa junto do protocolo para ver o
        pedido completo.
      </p>
      <p className="mt-2 text-[12px] leading-relaxed text-admin-text">
        {hasEmail
          ? "Se o cidadão perder a chave, ele recupera pelo site, na consulta de protocolo, informando o protocolo e o e-mail do pedido."
          : "Este pedido tem telefone como contato: atualize para um e-mail (seção de dados do solicitante) para o cidadão poder recuperar a chave pelo site, caso a perca."}
      </p>
    </div>
  );
}
