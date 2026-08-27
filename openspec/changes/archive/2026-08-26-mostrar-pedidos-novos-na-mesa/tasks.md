## 1. Núcleo: ordenação da mesa

- [x] 1.1 Em `src/core/overview/desk.ts`, inverter o `tieBreak` do tier de rotina (tier 4) em
      `rankOne` para mais novo primeiro (`-createdAtMs`), inclusive no ramo de LGPD não
      crítico; tiers 1 e 2 ficam como estão
- [x] 1.2 Em `src/core/overview/desk.test.ts`, inverter o teste "demais itens ordenam do mais
      antigo para o mais novo" e cobrir que urgências (tier 1 e 2) seguem na frente de um item
      recém-chegado

## 2. UI: aviso de itens fora do corte

- [x] 2.1 Em `desk-list.tsx`, aceitar `totalCount` e, quando `totalCount > items.length`,
      renderizar rodapé "+ N itens em aberto" linkando para `/admin/pedidos`
- [x] 2.2 Em `src/app/admin/(dashboard)/page.tsx`, passar `deskItems.length` como `totalCount`
      para `DeskList`

## 3. Verificação

- [x] 3.1 Rodar `node --test` e ajustar `e2e/admin-overview.spec.ts` se assertar a ordem da
      mesa; rodar o e2e afetado
- [x] 3.2 Conferir a Visão geral no browser com 6+ itens em aberto: pedido mais novo no topo do
      bloco de rotina e rodapé com a contagem correta
