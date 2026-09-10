## 1. E-mail à serventia

- [x] 1.1 Em `src/lib/email/service-request.ts`, adicionar `notifyOfficePaymentReported`, moldada
      em `notifyCitizen` (mesmo arquivo) e em `sendComplianceSubmittedEmails`
      (`src/lib/email/compliance.ts`): monta um `EmailText` (assunto com o protocolo, parágrafo
      citando requerente e valor via `formatCents` de `src/core/request/money.ts`, botão "Ver o
      pedido", rodapé deixando claro que é só um aviso) e envia com `sendEmail` para
      `tenant.contacts.email`, usando `tenantEmailIdentity` e `renderEmailCardHtml`/
      `renderEmailCardText` (cartão com botão — não `renderNoticeEmailHtml`, que é o padrão
      "sem conteúdo" pensado para o cidadão).
- [x] 1.2 URL do botão: `https://${tenant.hosts[0]}/admin/pedidos/${protocolNumber}`, mesmo padrão
      do `panelUrl` já usado em `src/app/admin/(dashboard)/adequacao/actions.ts`.
- [x] 1.3 Disparar o envio via `after()` (fire-and-forget, mesmo padrão de `notifyCitizen`):
      nunca lançar para o chamador, capturar falha do Postmark com `console.error` sob uma tag
      própria (ex.: `email.payment-reported`).

## 2. Disparo no autorrelato de pagamento

- [x] 2.1 Em `reportPayment` (`src/app/(public)/protocolo/actions.ts`), chamar
      `notifyOfficePaymentReported` depois que `attachToRequest` grava o comprovante com sucesso,
      cobrindo tanto o primeiro envio quanto o reenvio (a função dispara sempre, independente do
      `if (request.status !== "payment-reported")` que decide só a transição de andamento).
- [x] 2.2 Passar o nome do requerente (`applicantName`, quando presente) e `amountCents` (já
      garantido não nulo pela checagem existente em `reportPayment`) para a nova função.
- [x] 2.3 Confirmar que nenhum outro ponto de mudança de andamento para "Pago" (a confirmação do
      operador, em `src/app/admin/(dashboard)/pedidos/[protocolo]/actions.ts`) passa a disparar
      este e-mail.

## 3. Verificação

- [ ] 3.1 Sem `POSTMARK_SERVER_TOKEN` (fallback de log), rodar o fluxo "Já paguei" localmente
      (primeiro envio e reenvio) e conferir no console o destinatário (`tenant.contacts.email` do
      tenant de teste) e o assunto/corpo do aviso. **Não verificado nesta sessão**: o worktree não
      tem um Postgres acessível (`DATABASE_URL` ausente, sem Docker rodando), então o fluxo público
      completo (que grava no banco) não roda aqui. Pendente de rodar num ambiente com banco (local
      com Postgres/Docker de pé, ou preview) antes de mesclar.
- [x] 3.2 Rodar `node --test src/core/email/*.test.ts` e `node --test src/db/service-request.test.ts`
      para garantir que nada nas dependências reaproveitadas quebrou. (PGlite embutido: roda sem
      banco externo. 13 + 20 testes, todos verdes.)
- [ ] 3.3 Rodar `pnpm exec playwright test e2e/service-request.spec.ts e2e/admin-service-requests.spec.ts`
      localmente para confirmar que o fluxo de "Já paguei" e a confirmação manual de pagamento
      continuam passando (suíte e2e completa fica para o CI). **Não verificado nesta sessão**: os
      testes que gravam no banco (`the citizen reports a payment with a comprovante...` incluso)
      são pulados pelo próprio `test.skip(!process.env.DATABASE_URL, ...)` sem um Postgres real
      disponível neste worktree. Mesma pendência do item 3.1.

## 4. Qualidade

- [x] 4.1 `pnpm typecheck` (sem erros)
- [x] 4.2 `pnpm lint` (1 arquivo precisou de `pnpm format`, já aplicado; check limpo depois)
