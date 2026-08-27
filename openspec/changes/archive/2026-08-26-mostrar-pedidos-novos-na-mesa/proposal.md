## Why

A "Sua mesa hoje" da Visão geral ordena os itens de rotina do mais antigo para o mais novo e
corta nos 6 primeiros. Quando há mais de 6 itens em aberto — o caso real do cartório, com
pedidos parados há 48, 24 e 11 dias — os pedidos que chegaram ontem nunca aparecem na mesa: o
operador só descobre que há pedido novo se abrir a fila de pedidos por conta própria. Relato do
cartório: "os pedidos novos não estão aparecendo aqui, e não estão em ordem".

## What Changes

- Na mesa, os itens de rotina (tier sem urgência) passam a ordenar do mais novo para o mais
  antigo, igual à fila de pedidos que o operador já conhece. Chegou pedido ontem, ele aparece no
  topo do bloco de rotina.
- Os dois tiers de urgência continuam na frente, como hoje: LGPD perto do prazo/vencido
  primeiro, depois pedido com exigência cumprida aguardando retomada.
- Quando o corte de 6 esconde itens, a mesa SHALL dizer quantos ficaram de fora, com link para a
  fila de pedidos — para "não ter como saber" nunca mais ser verdade.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `admin-overview`: novo requisito descrevendo a ordenação da "Sua mesa hoje" (urgência na
  frente, rotina do mais novo para o mais antigo) e o aviso de itens fora do corte. A spec atual
  ainda não descreve a mesa (ficou do redesign sem sincronizar), então o delta adiciona o
  requisito em vez de alterar um existente.

## Impact

- `src/core/overview/desk.ts` — `rankDeskItems`: inverter o `tieBreak` do tier de rotina.
- `src/core/overview/desk.test.ts` — o teste "demais itens ordenam do mais antigo para o mais
  novo" inverte, e um teste novo cobre o aviso de corte.
- `src/app/admin/(dashboard)/_components/desk-list.tsx` e
  `src/app/admin/(dashboard)/page.tsx` — rodapé com a contagem de itens fora do corte.
- `e2e/admin-overview.spec.ts` — ajustar se asserta a ordem da mesa.
- Sem migração de banco, sem mudança de query.

## Não-objetivos

- Não muda o limite de 6 itens da mesa nem cria paginação na Visão geral.
- Não muda os critérios dos tiers de urgência (LGPD e exigência cumprida).
- Não cria notificação de pedido novo (e-mail, push, badge); só corrige a visibilidade na mesa.
- Não mexe na ordenação da fila `/admin/pedidos`, que já é do mais novo para o mais antigo.
