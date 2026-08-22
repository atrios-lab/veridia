## 1. Recibos ao protocolar

- [x] 1.1 Em `src/app/(public)/lgpd/actions.ts` (`submitDataRights`), chamar `notifyCitizen` após `createRecord` com assunto "Requerimento recebido" e corpo instruindo a guardar protocolo e chave mostrados na tela
- [x] 1.2 Em `src/app/(public)/ouvidoria/actions.ts` (`submitManifestation`), chamar `notifyCitizen` após `createRecord`; nenhum check de anonimato no chamador — `notifyCitizen` já ignora contato ausente/telefone (mesmo padrão de `ouvidoria/[protocolo]/actions.ts`)
- [x] 1.3 Em `src/app/admin/(dashboard)/pedidos/novo/actions.ts` (`createManualServiceRequest`), chamar `notifyCitizen` após `createServiceRequest` com corpo "guarde o protocolo e a chave entregues no atendimento"

## 2. Aviso de valor informado

- [x] 2.1 Em `setAmountAction` (`pedidos/[protocolo]/actions.ts`), detectar se o pedido já tinha valor antes do set (via o `findById`/retorno que custar menos uma query) e chamar `notifyCitizen` apenas na primeira vez, assunto "Valor do pedido informado", sem o valor no corpo

## 3. Verificação

- [x] 3.1 Rodar `pnpm typecheck` e `pnpm lint`
- [ ] 3.2 (bloqueada nesta máquina: `.env` sem `DATABASE_URL`, e o webServer do Playwright sobe sem banco) Sem `POSTMARK_SERVER_TOKEN` local, exercitar os quatro fluxos e conferir no log `[email]` que: LGPD e balcão com e-mail logam envio; ouvidoria anônima e contato-telefone não logam nada; segundo set de valor não loga
