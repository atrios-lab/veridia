## Contexto

`listDeskItems` (`src/lib/admin-overview.ts`) resolve `awaitingOffice = !office || citizen > office`.
`office` vem do `audit_log` com `actor_id IS NOT NULL` e ação na allowlist `OFFICE_ANSWER_ACTIONS`.
`citizen` vem de `lastCitizenMessageAt` (mensagens com `author = 'citizen'`), com fallback em
`created_at` do pedido.

`reportPayment` (`src/app/(public)/protocolo/actions.ts`) grava um anexo `kind = "payment-receipt"`
e chama `updateRequestStatus(..., null)`, que audita `service-request.status` sem ator. O filtro
`isNotNull(actorId)` já exclui essa linha do lado do cartório (certo), mas nada a soma ao lado do
cidadão. `attachExtraDocument` grava anexo `kind = "citizen"` e não audita nada.

## Decisão: terceira fonte, os anexos do cidadão

Nova consulta `lastCitizenAttachmentAt(tenantSlug, requestIds)` no mesmo molde de
`lastCitizenMessageAt`: `max(created_at)` de `service_request_attachments` agrupado por
`request_id`, filtrando `kind IN ('payment-receipt', 'citizen', 'signed-form')`. Os três são os
kinds que só o cidadão escreve (`"office"` é o cartório; anexos de mensagem em exigência já contam
pela mensagem). Em `listDeskItems`:

```
citizen = max(createdAt, lastCitizenMessageAt, lastCitizenAttachmentAt)
```

Os anexos gravados na própria criação (`citizen`, `signed-form`) têm `created_at` praticamente
igual ao do pedido e não alteram o resultado; entram no filtro para o kind ficar descrito pela
origem, não pela tela.

A consulta roda no mesmo `Promise.all` das outras duas, limitada aos ids dos pedidos abertos da
sessão, como as demais.

## Alternativas descartadas

- **Auditar o lado do cidadão** (`actor_id IS NULL`): o `reportPayment` já deixa esse rastro, mas
  o documento extra e as mensagens não, e o projeto decidiu não auditar o cidadão. Cobriria menos
  e contradiz a decisão registrada.
- **`updated_at` como "alguém mexeu depois do cartório"**: `touchRequest` bumpa em qualquer anexo,
  mas informar valor, rascunho e nota interna também bumpam, e trariam de volta à mesa um pedido
  já respondido. Descartado.

## Resumo na mesa

`rankOne` cai no caso padrão para `payment-reported` e diz "Novo pedido de serviço" / "Ver
pedido". Passa a dizer "Pagamento informado, comprovante a conferir" e "Conferir pagamento".
Tier e ordenação não mudam (tier 4, mais novo primeiro), para não reabrir a discussão de
prioridade da mesa neste change.

## Verificação

`admin-overview.ts` não tem teste unitário (consulta ao banco); a cobertura fica no `desk.test.ts`
para o resumo e na conferência manual pelo host do cartório: pedido em "Aguardando pagamento"
fora da mesa, "Já paguei" pela consulta, pedido de volta na mesa.
