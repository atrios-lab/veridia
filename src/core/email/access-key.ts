/**
 * What the access key e-mail says besides the key itself (decision of
 * 12/11/2026): the link that opens the consult with the protocol already
 * filled in, and the step by step for whoever has never used it. Pure, so
 * the e-mail's HTML, its plain text and the tests read the same words.
 *
 * The key never goes in the link: a link is copied, forwarded and kept in
 * browser history, and the key is what keeps the request private. The
 * citizen types it, and only it.
 */

export type AccessKeyReason = "received" | "counter" | "recovered";

/** The consult with the protocol filled in; empty without a host. */
export function consultLink(
  host: string | undefined,
  protocolNumber: string,
): string {
  if (!host) return "";
  return `https://${host}/acompanhar?numero=${encodeURIComponent(protocolNumber)}`;
}

export const ACCESS_KEY_INTROS: Record<AccessKeyReason, string> = {
  received:
    "Recebemos o seu pedido pelo site. Seguem o número do protocolo e a chave de acesso, com os quais você acompanha o andamento.",
  counter:
    "O seu pedido foi protocolado no balcão da serventia. Seguem o número do protocolo e a chave de acesso, com os quais você acompanha o andamento pela internet.",
  recovered:
    "Uma chave de acesso nova foi gerada para o seu pedido. Use-a com o número do protocolo abaixo.",
};

export const ACCESS_KEY_BUTTON = "Acompanhar o pedido";

/** The step by step, in the order the citizen will meet each screen. */
export function accessKeySteps(): string[] {
  return [
    `Clique no botão "${ACCESS_KEY_BUTTON}". A página abre com o número do protocolo já preenchido.`,
    "Digite a chave de acesso informada acima. Letras maiúsculas ou minúsculas e os traços não fazem diferença.",
    'Clique em "Ver andamento". Ali você vê a situação do pedido, responde a exigências, faz o pagamento e baixa os documentos prontos.',
    "Quando houver novidade, como exigência, valor a pagar ou documento pronto, avisaremos por este e-mail.",
  ];
}
