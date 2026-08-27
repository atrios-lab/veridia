## Context

`rankDeskItems` (`src/core/overview/desk.ts`) ranqueia a mesa em tiers: 1 = LGPD perto do
prazo/vencido, 2 = pedido com exigência cumprida, 4 = rotina. Dentro de cada tier o `tieBreak`
é `createdAt` crescente (mais antigo primeiro) e o resultado é cortado em `DESK_LIMIT = 6`. Com
mais de 6 itens de rotina em aberto, os recém-chegados caem fora do corte e ficam invisíveis na
Visão geral. O componente `DeskList` recebe só os itens já cortados; a página
(`src/app/admin/(dashboard)/page.tsx`) tem o total em `deskItems.length`.

## Goals / Non-Goals

Goals:
- Pedido novo aparece na mesa assim que chega, acima dos itens de rotina antigos.
- O operador sabe quantos itens em aberto o corte de 6 escondeu, com caminho para vê-los.

Non-Goals: ver "Não-objetivos" da proposta (limite de 6, critérios de urgência, notificações e
ordenação da fila ficam como estão).

## Decisions

1. **Inverter o `tieBreak` da rotina para `-createdAtMs`** (mais novo primeiro), mantendo os
   tiers 1 e 2 na frente com seus tie-breaks atuais. Alternativa considerada: criar um tier
   próprio para "chegou nas últimas 24h". Descartada — vira duas ordenações (novos por chegada,
   velhos por espera) dentro do mesmo bloco visual "ordenada por urgência", mais difícil de
   explicar ao operador do que "urgências primeiro, depois os mais recentes". A fila
   `/admin/pedidos` já é mais-novo-primeiro; a mesa passa a bater com o modelo mental que o
   cartório demonstrou ter.

2. **Rodapé de corte no `DeskList`**: quando `totalCount > items.length`, uma linha
   "+ N itens em aberto" linkando para `/admin/pedidos`. A página passa `totalCount`
   (`deskItems.length`, que ela já calcula) como prop. Alternativa: retornar a contagem de
   `rankDeskItems`. Descartada — a página já tem o total; mudar a assinatura do núcleo para um
   dado que o chamador possui é ruído.

3. **Sem mudança de query**: `listDeskItems` já traz todos os abertos; ordenação é
   responsabilidade do núcleo puro, onde já está.

## Risks / Trade-offs

- [Itens muito antigos somem da mesa quando há 6+ mais novos] → é o comportamento pedido; eles
  continuam contados no cabeçalho ("itens na mesa"), na "Situação dos canais" e no rodapé novo,
  e visíveis na fila. Se espera longa virar urgência no futuro, é um tier novo — fora de escopo.
- [Rodapé linka para `/admin/pedidos`, mas o excedente pode incluir LGPD/ouvidoria] → aceito: o
  caso dominante é pedido de serviço, e "Situação dos canais" já dá o caminho por canal.

## Migration Plan

Deploy normal, sem migração de banco. Rollback = revert do commit.

## Open Questions

Nenhuma.
