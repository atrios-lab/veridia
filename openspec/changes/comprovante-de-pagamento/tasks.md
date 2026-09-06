## 1. Núcleo: o andamento "Pagamento informado"

- [x] 1.1 Em `src/core/request/kinds.ts`, acrescentar `payment-reported` a `SERVICE_REQUEST_STATUSES` (depois de `awaiting-payment`), à fase `payment`, ao rótulo ("Pagamento informado") e a `SUGGESTED_NEXT_STATUSES` (`["paid", "awaiting-payment", "cancelled"]`); manter as sugestões de `awaiting-payment` como estão
- [x] 1.2 Em `status-tone.ts`, declarar o tom `waiting` para `payment-reported`; rodar `pnpm typecheck` e os testes de `kinds`, `status-tone` e `queue-order` (`node --test`) para confirmar que os `Record` fecham
- [x] 1.3 Confirmar que `pauseReasons` (`src/core/request/deadline.ts`) segue pausando só em `awaiting-payment`, sem alteração; cobrir com um caso no teste existente

## 2. Escrita do cidadão

- [x] 2.1 Em `src/lib/service-request.ts`, mudar `updateRequestStatus` para `actorId: string | null` (a auditoria já aceita nulo) e ajustar chamadores que dependam do tipo
- [x] 2.2 Em `src/app/(public)/protocolo/actions.ts`, criar `reportPayment(_prev, formData)` no molde de `attachExtraDocument`: `findByProtocolWithKey` (resposta neutra), `isRateLimited`, `collectAttachments(formData, "comprovante", { limit: 1 })` com arquivo obrigatório; recusar no servidor quando o pedido não tem valor, não está aberto ou já está `paid`; gravar o anexo com `kind = "payment-receipt"` e depois `updateRequestStatus(..., "payment-reported", null)` (sem mudar o andamento se já estiver `payment-reported`)
- [x] 2.3 Em `lookupProtocolDetail`, adicionar `paymentReceipt?: { displayName, sentAt }` (o anexo `payment-receipt` mais recente) e deixar de montar `pix` quando o andamento é `payment-reported`; manter `citizenDocuments` filtrando só `citizen`

## 3. Telas do cidadão

- [x] 3.1 Em `protocol-lookup.tsx` (`PaymentCard`), ramificar: `paymentSettled` → confirmado; `payment-reported` → "Comprovante recebido, em conferência" com o nome do arquivo e opção de reenviar; senão → valor + QR/balcão + botão "Já paguei" que revela `<input type="file" name="comprovante">` e envia ao escolher (mesmo padrão de `attachments-section.tsx`), com `useActionState(reportPayment)` e mensagens de erro/sucesso; atualizar o passo "Aguardando pagamento" da timeline para "Pagamento informado" nesse andamento
- [x] 3.2 Em `protocol-trilho.tsx` (`PayCard` e `computeSteps`/`headline`), fazer o mesmo e trocar o texto "O pagamento é confirmado sozinho… Não precisa mandar comprovante" pela instrução de enviar o comprovante
- [x] 3.3 Garantir que nenhum texto novo é hardcoded fora do padrão já usado nessas telas e que `pnpm check:tokens` e `pnpm check:dashes` passam

## 4. Painel

- [x] 4.1 Em `pedidos/[protocolo]/page.tsx`, localizar o anexo `payment-receipt` mais recente e passar `receipt` para `AmountSection`; confirmar que ele já cai em "Documentos anexados pelo cidadão" (`kind !== "office"`)
- [x] 4.2 Em `amount-section.tsx`, mostrar "Pagamento informado em <data e hora>" com o link do comprovante (reusar `attachment-link.ts`) quando houver `receipt`
- [x] 4.3 Conferir como `listRequestHistory` rotula a entrada de andamento com ator nulo; se ficar vazia, rotular "Cidadão" no leitor

## 5. Testes

- [x] 5.1 `node --test`: `kinds.test.ts` (fase e sugestões do novo andamento), `status-tone.test.ts`, `queue-order.test.ts`, e um caso em `src/db/service-request.test.ts` para `updateRequestStatus` com ator nulo
- [ ] 5.2 `e2e/service-request.spec.ts`: com valor e QR visíveis, "Já paguei" sem arquivo é recusado; com PDF, a consulta mostra "em conferência" sem QR, o andamento vira `payment-reported` e o comprovante existe com `kind = "payment-receipt"`; devolver para `awaiting-payment` via SQL reexibe o QR
- [ ] 5.3 `e2e/admin-service-requests.spec.ts`: pedido em `payment-reported` aparece na fila com o selo "Pagamento informado" e, no detalhe, mostra o link do comprovante e "Pago" como primeira sugestão
- [ ] 5.4 Rodar os checks escopados (`pnpm typecheck`, `pnpm lint`, `pnpm test`, specs e2e tocados); o `pnpm e2e` completo fica para o CI do PR
