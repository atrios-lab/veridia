## 1. Ordenação

- [x] 1.1 Criar `_components/queue-order.ts` com `QUEUE_GROUPS`, `queueGroupOf` e
      `compareQueueRows`; exportar o tipo `Tone` de `status-tone.ts`.
- [x] 1.2 Teste `queue-order.test.ts`: terminais caem em Encerrados, e a ordem banda, urgência,
      chegada.

## 2. Fila

- [x] 2.1 Em `pedidos/page.tsx`, montar as linhas com banda e urgência, ordenar com
      `compareQueueRows` e inserir o cabeçalho de banda (nome e quantidade) quando a banda muda.
- [x] 2.2 Esconder os cabeçalhos quando só uma banda aparece.

## 3. Verificação

- [x] 3.1 `pnpm typecheck`, `biome check`, `check:dashes` e o teste novo passando.
- [ ] 3.2 Conferir a fila no navegador com pedidos em bandas diferentes (fica para a revisão do PR: o painel exige login).
