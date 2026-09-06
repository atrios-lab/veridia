## 1. Ordenação

- [x] 1.1 Em `_components/queue-order.ts`, fazer `queueGroupOf("paid")` devolver `waiting` e
      atualizar o comentário: banda = tom, com duas correções (terminais e pago).
- [x] 1.2 Em `queue-order.test.ts`, fixar `queueGroupOf("paid") === "waiting"` e cobrir os
      cenários "Pago sobe para Aguardando" e "Pago vencido sobe dentro de Aguardando".

## 2. Verificação

- [x] 2.1 `pnpm typecheck`, `biome check` e `queue-order.test.ts` passando.
- [ ] 2.2 Conferir no navegador, pelo host do cartório, que "Pago" aparece sob "Aguardando"
      com o selo verde e que a contagem das bandas bate (fica para a revisão do PR: o painel exige login).
