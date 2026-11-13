/**
 * What the access key e-mail says besides the key itself (decision of
 * 12/11/2026): the link that opens the consult with the protocol already
 * filled in, and the step by step for whoever has never used it. Pure, so
 * the e-mail's HTML, its plain text and the tests read the same words.
 *
 * The link carries the key after the "#" (see `consultLink`), so the
 * citizen only clicks: never in the query, which servers log.
 */

/** "office": the office issued a new key from the panel (decision of
 * 13/11/2026), for a client who lost it or gave a wrong e-mail. */
export type AccessKeyReason = "received" | "counter" | "recovered" | "office";

/**
 * The consult with the protocol filled in and, given the key, opened
 * straight away (decision of 12/11/2026: the citizen only clicks). The key
 * goes after the "#": a browser never sends that part to the server, so it
 * reaches no access log, and the page wipes it from the address bar as
 * soon as it reads it. Empty without a host.
 */
export function consultLink(
  host: string | undefined,
  protocolNumber: string,
  accessKey?: string,
): string {
  if (!host) return "";
  const base = `https://${host}/acompanhar?numero=${encodeURIComponent(protocolNumber)}`;
  return accessKey ? `${base}#chave=${encodeURIComponent(accessKey)}` : base;
}

export const ACCESS_KEY_INTROS: Record<AccessKeyReason, string> = {
  received:
    "Recebemos o seu pedido pelo site. Seguem o número do protocolo e a chave de acesso, com os quais você acompanha o andamento.",
  counter:
    "O seu pedido foi protocolado no balcão da serventia. Seguem o número do protocolo e a chave de acesso, com os quais você acompanha o andamento pela internet.",
  recovered:
    "Uma chave de acesso nova foi gerada para o seu pedido. Use-a com o número do protocolo abaixo.",
  office:
    "A serventia gerou uma nova chave de acesso para o seu pedido. Seguem o número do protocolo e a nova chave, com os quais você acompanha o andamento.",
};

export const ACCESS_KEY_BUTTON = "Acompanhar o pedido";

/** The step by step, in the order the citizen will meet each screen. */
export function accessKeySteps(): string[] {
  return [
    `Clique no botão "${ACCESS_KEY_BUTTON}". O pedido abre direto, com o protocolo e a chave de acesso já preenchidos.`,
    "Se a página pedir a chave (por exemplo, ao abrir o endereço em outro aparelho), digite a chave de acesso informada acima. Letras maiúsculas ou minúsculas e os traços não fazem diferença.",
    'Clique em "Ver andamento". Ali você vê a situação do pedido, responde a exigências, faz o pagamento e baixa os documentos prontos.',
    "Quando houver novidade, como exigência, valor a pagar ou documento pronto, avisaremos por este e-mail.",
  ];
}
