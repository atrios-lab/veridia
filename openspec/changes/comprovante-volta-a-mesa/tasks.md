## 1. Vez do cartório

- [ ] 1.1 Em `src/lib/admin-overview.ts`, criar `lastCitizenAttachmentAt(tenantSlug, requestIds)`
      no molde de `lastCitizenMessageAt`: `max(created_at)` de `service_request_attachments`
      por `request_id`, com `kind IN ('payment-receipt', 'citizen', 'signed-form')`.
- [ ] 1.2 Em `listDeskItems`, rodar a consulta no mesmo `Promise.all` e fazer `citizen` ser o
      máximo entre `createdAt`, mensagem e anexo. Atualizar o comentário do `DeskItemInput.awaitingOffice`
      em `desk.ts` para citar a terceira fonte.

## 2. Resumo na mesa

- [ ] 2.1 Em `src/core/overview/desk.ts`, `defaultSummary` devolve "Pagamento informado,
      comprovante a conferir" e `defaultActionLabel` devolve "Conferir pagamento" para
      `payment-reported`.
- [ ] 2.2 Em `desk.test.ts`, cobrir o resumo e a ação de `payment-reported`, mantendo tier de rotina.

## 3. Verificação

- [ ] 3.1 `pnpm typecheck`, `biome check` e `desk.test.ts` passando.
- [ ] 3.2 Pelo host do cartório no Homolog: pedido em "Aguardando pagamento" fora da mesa,
      "Já paguei" pela consulta, pedido de volta na mesa com o resumo novo.
