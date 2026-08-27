## Why

Na fila de pedidos o selo do andamento é colorido por fase, não por urgência: "Com exigência" sai
verde, exatamente igual a "Em análise" e "Deferido", quando é justamente o andamento em que o
pedido travou e alguém precisa agir. O balcão pediu vermelho para exigência, no mesmo grau de
destaque que o laranja de "Aguardando pagamento" já tem.

## What Changes

- A cor do selo passa a ser decidida por **tom** (o que o andamento pede do operador), não por
  fase. Cada um dos dezoito andamentos ganha um tom explícito, sem exceções avulsas por cima de
  uma regra que já não os explicava.
- Cinco tons, todos com token já existente no tema do painel:
  - **Vermelho** (`admin-error`): Com exigência, Aguardando exigência, Indeferido — o pedido está
    travado ou terminou sem registro.
  - **Laranja** (`admin-warning`): Novo, Protocolado, Aguardando pagamento — esperando alguém
    começar ou pagar.
  - **Verde** (`admin-success`): Em análise, Prenotado, Em qualificação, Pago, Em processamento,
    Registrado, Averbado, Deferido — trabalho correndo na serventia.
  - **Tinta do escritório** (`admin-primary`): Disponível para retirada, Concluído.
  - **Cinza** (`admin-readonly`): Cancelado, Arquivado.
- Nenhuma cor nova: só remanejo dos tokens que já existem em `@theme static`.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `admin-service-requests`: o requisito que hoje diz que o andamento é apresentado "colapsado em
  fases" na fila passa a definir a cor do selo por tom, com exigência em vermelho.

## Non-Goals

- Não muda a lista dos dezoito andamentos, os rótulos, as transições sugeridas nem as fases usadas
  para agrupar (que continuam servindo à mesa de trabalho e à linha do tempo).
- Não mexe nas cores do site público (consulta de protocolo), que usa um selo único de marca.
- Não introduz hex novo nem token novo no design system.
- Não toca nos selos dos outros canais (agendamento, LGPD, ouvidoria).

## Impact

- `src/app/admin/(dashboard)/pedidos/_components/status-badge.tsx`: mapa de estilos reescrito.
- Telas afetadas: fila de pedidos e detalhe do pedido, que compartilham o mesmo componente.
- Sem migração, sem mudança de API, sem mudança de dados.
