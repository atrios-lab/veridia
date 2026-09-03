## Why

O prazo do pedido corre contra a serventia mesmo quando a bola está com o cidadão: um pedido
devolvido com exigência, ou parado esperando pagamento, aparece na fila como "Prazo vencido há 10
dias" sem que o cartório tenha nada a fazer. Hoje a fila de `/admin/pedidos` tem nove pedidos
"Com pendência", todos vencidos por esse motivo, e o selo vermelho deixou de dizer alguma coisa.
A lei conta o prazo do oficial só enquanto há ato dele pendente (Lei 6.015, arts. 188 e 198): o
relógio da serventia para na exigência e recomeça na reapresentação.

## What Changes

- O prazo do pedido é **suspenso automaticamente** enquanto houver exigência pendente cadastrada
  no pedido, ou enquanto o pedido estiver em "Aguardando pagamento" com valor lançado. A pausa
  nasce do lastro (a exigência escrita, a cobrança), nunca do andamento sozinho.
- Ao cessar o último motivo de pausa, o prazo **retoma**: para ato com prazo legal, a contagem
  recomeça do zero na data da retomada (é a lei que dá prazo novo da reapresentação); para ato no
  padrão do cartório, a contagem continua de onde parou.
- Enquanto suspenso, a fila e o detalhe trocam o selo de vencimento por um selo neutro que diz há
  quantos dias úteis o pedido espera o cidadão, e a consulta pública diz que o prazo está suspenso
  e o que falta (exigência, pagamento).
- Suspensão e retomada entram no histórico do pedido.
- Os pedidos já parados em exigência ou pagamento recebem a data de início da pausa por um
  script único (data da exigência pendente mais antiga; para pagamento, a última atualização).
- Os controles manuais de prazo (zerar, ajustar dias) continuam valendo durante a pausa.

## Capabilities

### New Capabilities

(nenhuma)

### Modified Capabilities

- `admin-service-requests`: o prazo do pedido ganha estado suspenso, com regras de início,
  retomada, selo na fila, ordem dentro da banda, resumo no detalhe e auditoria.
- `service-request`: a consulta pública do protocolo informa o prazo suspenso e o motivo, em vez
  da contagem de dias.

## Impact

- `src/core/request/deadline.ts`: `pausedOn` no prazo gravado, motivos de pausa e retomada como
  funções puras.
- `src/core/overview/urgency.ts`: `deadlineUrgency` ganha o estado "pausado".
- `src/lib/service-request.ts`: uma função de reconciliação da pausa, chamada depois de cada
  escrita que muda um motivo (exigência registrada/cumprida/excluída, valor lançado/removido,
  andamento trocado), com auditoria própria.
- `src/app/admin/(dashboard)/pedidos/`: fila (selo e ordem), detalhe (cabeçalho e resumo do
  prazo), server actions que passam a reconciliar.
- `src/app/(public)/protocolo/`: leitura e texto do prazo suspenso na consulta.
- Script único de backfill para os pedidos abertos já parados. Sem migração de schema: o campo
  novo vive no JSONB `details` que o prazo já ocupa.
- Depende do comparador da fila introduzido em `fila-por-prioridade` (em andamento) para a ordem
  dos pausados dentro da banda.

## Non-Goals

- Contador de caducidade da prenotação (Lei 6.015, art. 205) como relógio próprio: o selo
  "aguardando o cidadão há N dias" é o que a serventia vê por ora.
- Pausar por qualquer outro motivo (andamento sem exigência cadastrada, aguardando pagamento sem
  valor, feriado municipal).
- Pausa no prazo do canal LGPD: os quinze dias são da Lei 13.709 e não suspendem.
- Aviso ao cidadão por e-mail quando o prazo suspende ou retoma.
- Registrar, no evento de auditoria, o valor do prazo antes e depois (segue o padrão atual:
  quem e quando; o que ficou está no registro).
