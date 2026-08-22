## Why

O canal de solicitação pública (`/solicitar`) manda e-mail de recibo ao protocolar, mas três eventos irmãos ficaram mudos: o requerimento LGPD (que tem prazo legal de 15 dias correndo), a manifestação de ouvidoria identificada e o pedido lançado no balcão. O cidadão que fechou a aba — ou saiu do cartório com um papel — perdeu o único rastro do protocolo. Além disso, quando o operador informa o valor a pagar, o pedido para de andar e ninguém avisa: é o único evento acionável do pedido que não dispara o aviso que exigência, entrega e conclusão já disparam.

## What Changes

- Recibo por e-mail ao protocolar requerimento LGPD, quando o contato é e-mail (mesma regra do `/solicitar`: protocolo sim, chave jamais).
- Recibo por e-mail ao registrar manifestação de ouvidoria identificada com e-mail; a anônima segue sem nada (não há contato).
- Recibo por e-mail ao lançar pedido manual no balcão, quando o operador registrou um e-mail de contato.
- Aviso por e-mail quando o operador informa o valor do pedido pela primeira vez (correção de valor não reavisa).
- Todos via `notifyCitizen` existente: fire-and-forget, sem conteúdo, sem chave, sem infra nova.

## Capabilities

### New Capabilities

Nenhuma — todos os eventos cabem nas capacidades existentes.

### Modified Capabilities

- `data-rights-channel`: novo requisito de e-mail de confirmação do requerimento LGPD.
- `ombudsman-channel`: novo requisito de e-mail de confirmação da manifestação identificada.
- `admin-service-requests`: o lançamento manual passa a mandar recibo quando há e-mail; "Avisos por e-mail nas ações que afetam o cidadão" ganha o evento "valor informado".

## Impact

- `src/app/(public)/lgpd/actions.ts` — chamada a `notifyCitizen` após `createRecord`.
- `src/app/(public)/ouvidoria/actions.ts` — idem, apenas quando identificada (o próprio `notifyCitizen` já ignora contato ausente/telefone).
- `src/app/admin/(dashboard)/pedidos/novo/actions.ts` — chamada após `createServiceRequest`.
- `src/app/admin/(dashboard)/pedidos/[protocolo]/actions.ts` — chamada em `setAmountAction` quando o valor é informado pela primeira vez.
- Nenhuma mudança em `src/lib/email/*`: o transporte, o template de aviso e a política de melhor esforço já existem.
