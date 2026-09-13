## Why

Na consulta pública `/acompanhar`, quando um pedido é indeferido o cidadão não vê o motivo de
verdade. O cartório já digita a justificativa (ou anexa um PDF) ao indeferir — `statusReason` e
`rejectionDocumentAttachmentId` já chegam prontos em `lookupProtocolDetail` e já aparecem
corretamente na tela antiga `/protocolo` (`RequestDetail` em
[protocol-lookup.tsx](../../../src/app/(public)/protocolo/protocol-lookup.tsx)) — mas o trilho de
`/acompanhar` ([protocol-trilho.tsx](../../../src/app/(public)/acompanhar/protocol-trilho.tsx))
ignora esses campos e mostra um texto fixo dizendo "explicamos o motivo na mensagem que enviamos
para você" e "Enviamos o motivo para você". Nenhuma mensagem com o motivo é enviada ao cidadão em
nenhum canal — o texto descreve algo que não aconteceu. O cidadão indeferido também não recebe
nenhuma orientação sobre o que fazer a seguir, além de "fale com a gente".

## What Changes

- O card e o cabeçalho de indeferimento em `/acompanhar` passam a exibir a justificativa real do
  cartório (`result.statusReason`) e, quando houver, o link para baixar o PDF do indeferimento
  (`result.rejectionDocumentAttachmentId`) — o mesmo par de dados que `/protocolo` já exibe.
- Remover a afirmação de que um motivo foi "enviado" por mensagem (headline, card de indeferimento
  e item do histórico): nenhum e-mail ou notificação com o motivo existe hoje, então o texto deixa
  de prometer isso e passa a apontar para o motivo exibido ali mesmo na página.
- Adicionar orientação de próximo passo para o desfecho "Indeferido": instruir o cidadão a refazer
  o pedido de forma adequada à sua solicitação, cobrindo o que motivou o indeferimento.
- Desfecho "Cancelado" mantém texto próprio (cancelamento não implica pedido malfeito), mas também
  deixa de citar uma mensagem que não foi enviada.

## Não-objetivos

- Não altera como o cartório registra a justificativa ou o PDF de indeferimento (`status-section.tsx`,
  `validateStatusReason`) — só onde e como isso é exibido ao cidadão em `/acompanhar`.
- Não introduz envio de e-mail/notificação com o motivo do indeferimento. Se isso vier a ser
  necessário, é proposta própria.
- Não toca a tela `/protocolo` (`protocol-lookup.tsx`), que já exibe o motivo corretamente.
- Não muda o schema do pedido nem os campos retornados por `lookupProtocolDetail` — os dados já
  existem; o problema é só a renderização em `/acompanhar`.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `service-request`: a etapa final de desfecho negativo na consulta de protocolo (`/acompanhar`)
  passa a exigir a exibição do motivo real do indeferimento (texto e/ou documento) em vez de
  afirmar que um motivo foi enviado por mensagem, e a orientar o cidadão a refazer o pedido
  corretamente quando o desfecho é indeferimento.

## Impact

- `src/app/(public)/acompanhar/protocol-trilho.tsx`: `computeHeadline`, `buildLog`/histórico e
  `RejectedCard` passam a receber e exibir `statusReason` e `rejectionDocumentAttachmentId`, e a
  copy muda.
- Nenhuma migração de banco nem mudança de API: os campos já existem em `ServiceRequestDetail`
  ([actions.ts](../../../src/app/(public)/protocolo/actions.ts)).
