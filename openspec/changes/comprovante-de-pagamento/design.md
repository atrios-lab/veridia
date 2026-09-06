## Context

- O pagamento hoje é uma via de mão única: o painel informa `amountCents`, a consulta mostra o
  QR (`pixChargeFor` em `src/lib/pix-qr.ts`, chamado em `lookupProtocolDetail`), e o operador
  muda o andamento para "Pago" quando descobre que o dinheiro caiu. Nada volta do cidadão.
- `paymentSettled` (`protocolo/actions.ts:294`) é `status === "paid" || !isOpen(status)` e decide
  se o QR aparece. As duas telas do cidadão (`protocol-lookup.tsx` `PaymentCard`, `protocol-trilho.tsx`
  `PayCard`) leem esse campo.
- O cidadão já escreve no pedido em dois lugares: `attachExtraDocument` (documento avulso, 1
  arquivo, `attachToRequest(..., "citizen")`) e `writeCitizenMessage` (conversa da exigência,
  até 3 anexos). Ambos passam por `findByProtocolWithKey` + `isRateLimited` + `collectAttachments`.
- Andamentos são lista fechada em código (`SERVICE_REQUEST_STATUSES`, dezenove valores), não
  enum de banco. `STATUS_TONES` e `SUGGESTED_NEXT_STATUSES` são `Record` completos: um valor
  novo sem tom ou sem sugestão não compila.
- `updateRequestStatus(tenantSlug, id, status, actorId: string, deadline?)` grava o andamento e
  uma entrada de auditoria; `AuditEntry.actorId` já é `string | null`.
- `service_request_attachments.kind` é texto livre com três valores em uso: `citizen`,
  `signed-form`, `office`. O painel lista como "do cidadão" tudo que não é `office`
  (`pedidos/[protocolo]/page.tsx:140`); a consulta lista como documentos do cidadão só `citizen`
  (`protocolo/actions.ts:362`).
- `pauseReasons` (`src/core/request/deadline.ts`) pausa o prazo em `awaiting-payment` com valor.

## Goals / Non-Goals

**Goals:**
- O cidadão avisa que pagou e entrega o comprovante sem sair da consulta, nas duas telas.
- O balcão vê na fila e no detalhe que há pagamento a conferir, com o comprovante a um clique.
- Zero migração, zero dependência nova, zero rota nova: reuso do que já grava anexos e andamentos.

**Non-Goals:**
- Ver `proposal.md` (conciliação bancária, e-mails, validação do comprovante, pagamento sem
  comprovante, mudança na pausa do prazo).

## Decisions

- **Novo andamento `payment-reported` em vez de flag em `details`.** O ticket pede que a
  informação "suba no painel" e que depois o operador "mude o status". A fila, os filtros, o
  selo colorido, o contador e o detalhe já leem o andamento; um campo em JSONB precisaria de um
  indicador novo em cada um desses lugares. O andamento entra na fase Pagamento, com rótulo
  "Pagamento informado", tom `waiting` (laranja: alguém do balcão precisa agir, como em "Novo") e
  sugestões `["paid", "awaiting-payment", "cancelled"]`. As sugestões de "Aguardando pagamento"
  não mudam: quem move para "Pagamento informado" é o cidadão. Alternativa descartada:
  `details.paymentReportedAt` sem mudar andamento, que deixa a fila muda.
- **O cidadão escreve o andamento via `updateRequestStatus` com `actorId: null`.** Assinatura
  muda de `string` para `string | null`; a auditoria já aceita nulo ("ator não autenticado"). É a
  única escrita de andamento fora do painel, e é guardada no servidor: só a partir de um pedido
  aberto, com valor informado, que não esteja em `paid` nem já em `payment-reported`. Alternativa
  descartada: função nova `reportPaymentStatus` duplicando o UPDATE e o audit.
- **Comprovante = anexo do pedido com `kind = "payment-receipt"`.** Nenhuma coluna nova:
  `kind` é texto. No painel ele cai automaticamente na lista "Documentos anexados pelo cidadão"
  (`kind !== "office"`), o que já dá o download; o detalhe ainda destaca o último comprovante
  junto do valor (`AmountSection` ganha `receipt?: { displayName, id, sentAt }`). Na consulta
  ele fica fora de `citizenDocuments` (que filtra `citizen`) e aparece dentro do bloco de
  pagamento, onde o cidadão o enviou. Um segundo envio (comprovante errado) é aceito e grava
  outra linha; o painel mostra o mais recente.
- **Uma server action, `reportPayment`, clonando o esqueleto de `attachExtraDocument`.**
  Mesmo `findByProtocolWithKey` (resposta neutra), mesmo `isRateLimited`, mesmo
  `collectAttachments(formData, "comprovante", { limit: 1 })`, arquivo obrigatório. Grava o anexo e
  depois o andamento, nessa ordem: se o anexo falhar, nada muda; se o andamento falhar depois do
  anexo, o cidadão vê o erro genérico e tenta de novo (o segundo comprovante é aceito, ver acima).
  Sem transação: são duas escritas que já ocorrem separadas em todo o resto do módulo.
- **`pix` deixa de ser montado quando o andamento é `payment-reported`.** `paymentSettled`
  segue significando "confirmado" (as duas telas mostram "Pagamento confirmado" com ele). O
  detalhe ganha `paymentReceipt?: { displayName, sentAt }`, e as telas ramificam:
  `paymentSettled` → confirmado; `requestStatus === "payment-reported"` → "Comprovante recebido,
  em conferência" com o nome do arquivo; senão → valor + QR + botão "Já paguei" (que revela o
  `<input type="file">` e envia ao escolher, como `attachments-section.tsx` já faz). O texto "O
  pagamento é confirmado sozinho… Não precisa mandar comprovante" sai.
- **`pauseReasons` não muda.** Só `awaiting-payment` pausa o prazo. Em "Pagamento informado" o
  cidadão já fez a parte dele; o relógio volta a correr para a serventia. Se a conferência
  devolver o pedido para "Aguardando pagamento", a pausa volta sozinha.
- **`HAPPY_PATH` do painel não muda.** "Pagamento informado" é um desvio opcional; o detalhe
  já cai na linha "andamento atual" para quem está fora da barra. Evita redesenhar a timeline
  para um passo que nem todo pedido passa.
- **As duas telas do cidadão recebem o botão.** A feature flag `citizen-tracking-v2` decide qual
  está no ar; o ticket é urgente e a flag está desligada em produção, então `/protocolo` precisa
  tanto quanto `/acompanhar`.

## Risks / Trade-offs

- [Cidadão move o andamento de um pedido que estava em "Em análise" com valor informado, e não
  em "Aguardando pagamento"] → aceito: o QR já aparece nesse caso hoje; o andamento é fluxo
  livre por decisão anterior, e o operador vê de onde veio pelo histórico.
- [Comprovante falso ou errado] → a conferência é humana, como já é por e-mail; o operador
  devolve para "Aguardando pagamento", que reexibe o QR ao cidadão.
- [Entrada de auditoria com ator nulo aparece no histórico do pedido] → o histórico já lida com
  ator ausente (operador removido). Confirmar na implementação como a linha é rotulada; se
  aparecer vazio, rotular como "Cidadão" no leitor, não na gravação.
- [Conflito com `feature-flag-acompanhar` nos mesmos arquivos] → implementar em cima daquela
  branch ou depois do merge; ver `proposal.md`.
- [Duas escritas sem transação] → ordem anexo → andamento e reenvio permitido; ver decisão.
