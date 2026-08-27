## 1. Cor por tom no selo

- [x] 1.1 Em `src/app/admin/(dashboard)/pedidos/_components/status-badge.tsx`, trocar
  `PHASE_STYLES` + `STATUS_OVERRIDES` por `TONE_STYLES` (cinco tons) e
  `STATUS_TONES: Record<ServiceRequestStatus, Tone>` com as dezoito chaves, seguindo a tabela do
  design; atualizar o comentário do topo, que ainda explica a regra por fase.
- [x] 1.2 Conferir que `styleFor` não tem mais fallback: sem `??`, o tom vem do `Record` completo,
  e um andamento novo sem tom quebra o type-check.
- [x] 1.3 Confirmar que só os tokens já existentes (`admin-error-*`, `admin-warning-*`,
  `admin-success-*`, `admin-primary`, `admin-readonly-bg`, `admin-faint`) são usados — nenhum hex
  fora de `@theme`.

## 2. Prova

- [x] 2.1 Adicionar `status-tone.test.ts` ao lado do componente (o mapa mora em `status-tone.ts`, um `.ts` ao lado do `.tsx`: `node --test` não lê JSX): um caso afirmando que
  `with-requirement` e `awaiting-compliance` recebem o tom bloqueado, e outro afirmando que os
  dezoito andamentos de `SERVICE_REQUEST_STATUSES` têm tom declarado.
- [x] 2.2 Rodar `pnpm test` e o Biome.

## 3. Conferência na tela

- [x] 3.1 Abrir a fila de pedidos com um pedido em cada tom e conferir que exigência sai vermelha
  ao lado do laranja de "Aguardando pagamento".
- [x] 3.2 Abrir o detalhe do mesmo pedido e conferir que o selo tem a mesma cor da fila.
