# admin-overview

## Purpose

Tela inicial do painel administrativo (`/admin`): agrega os canais do cidadão (pedidos de
serviço, requerimentos LGPD, ouvidoria, agenda) para o operador saber o que há para fazer, com
links para cada fila. Sincronizado do change `add-admin-channel-queues`.

## Requirements

### Requirement: Contadores por canal levando à fila correspondente

A tela `/admin` SHALL mostrar um cartão por canal que a sessão tem permissão para operar —
Pedidos de serviço, Requerimentos LGPD, Ouvidoria, Agenda de atendimentos — cada um com a
quantidade de itens em aberto daquele canal e um link para a fila correspondente. Um canal cuja
permissão a sessão não tem SHALL ser omitido, sem quebrar o layout dos demais.

#### Scenario: Cartão leva à fila do canal

- **WHEN** o operador clica no cartão "Requerimentos LGPD"
- **THEN** é levado a `/admin/lgpd`

#### Scenario: Sessão sem uma permissão não vê o cartão daquele canal

- **WHEN** uma sessão não tem a permissão `channels.manage`
- **THEN** os cartões de Requerimentos LGPD, Ouvidoria e Agenda de atendimentos não aparecem na
  Visão geral

### Requirement: Atividade recente dos quatro canais em ordem cronológica

A tela `/admin` SHALL listar os eventos mais recentes dos canais que a sessão pode operar, mais
recente primeiro, cada um com um resumo em português e um link para o item correspondente.

#### Scenario: Evento de canal diferente aparece na mesma lista

- **WHEN** um pedido de serviço muda de andamento e uma manifestação de ouvidoria é registrada em
  seguida
- **THEN** os dois eventos aparecem na lista de atividade recente, na ordem em que aconteceram

#### Scenario: Link do evento leva ao item

- **WHEN** o operador clica num evento de agenda na atividade recente
- **THEN** é levado ao detalhe daquele pedido de horário em `/admin/agenda/[protocolo]`

### Requirement: Prazos a acompanhar em destaque

A tela `/admin` SHALL destacar, num bloco próprio, os requerimentos LGPD cujo prazo legal de 15
dias está a 3 dias ou menos do vencimento ou já vencido, e os pedidos de serviço cuja exigência
mais recente foi cumprida e cujo andamento ainda não avançou desde então. Cada item do bloco
SHALL linkar para o item correspondente.

#### Scenario: Requerimento LGPD perto do vencimento aparece no bloco

- **WHEN** um requerimento LGPD sem resposta está a 3 dias do prazo legal
- **THEN** ele aparece no bloco de prazos a acompanhar, com o prazo restante, e um link para o
  requerimento

#### Scenario: Exigência cumprida aguardando retomada aparece no bloco

- **WHEN** um pedido de serviço em "Em análise" tem uma exigência cumprida pelo cidadão sem
  exigência pendente
- **THEN** ele aparece no bloco de prazos a acompanhar como aguardando retomada, com um link para
  o pedido

#### Scenario: Sem prazos a acompanhar

- **WHEN** nenhum requerimento LGPD está perto do prazo nem vencido, e nenhum pedido de serviço
  tem exigência cumprida aguardando retomada
- **THEN** o bloco mostra que não há prazos pendentes, em vez de ficar vazio sem explicação
