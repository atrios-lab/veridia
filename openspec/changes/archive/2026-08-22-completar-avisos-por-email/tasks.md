## 1. Comprovante do auto-cancelamento

- [x] 1.1 Em `src/core/scheduling/emails.ts`, criar `buildAppointmentSelfCancelledEmail(facts)` (sem `reason`): primeira linha confirmando que o próprio cidadão cancelou, quando/serviço, botão "Agendar novo horário"
- [x] 1.2 Em `src/lib/email/appointment.ts`, criar `sendAppointmentSelfCancelledEmail(tenant, appointment)` com o try/log padrão do arquivo e botão para `/agendar`
- [x] 1.3 Em `src/app/(public)/agendar/cancelar/actions.ts` (`cancelByToken`), chamar o envio após `cancelAppointment`, usando o `appointment` já retornado por `findByCancelToken`

## 2. Aviso do formulário de exigência

- [x] 2.1 Em `attachRequirementFormAction` (`pedidos/[protocolo]/actions.ts`), após `attachToRequest`, buscar o pedido com `findById` e chamar `notifyCitizen` com assunto "Formulário disponível" e corpo instruindo a consultar com a chave para imprimir

## 3. Verificação

- [x] 3.1 Rodar `pnpm typecheck`, `pnpm lint` e `pnpm test`
- [ ] 3.2 (requer `DATABASE_URL` local) Exercitar os dois fluxos sem `POSTMARK_SERVER_TOKEN` e conferir no log `[email]` o comprovante do cancelamento e o aviso do formulário
