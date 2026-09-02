## Why

O operador hoje pode informar o valor do pedido e corrigi-lo, mas não pode voltar ao estado
"sem valor informado" depois que um valor já foi lançado — por exemplo, quando o valor foi
digitado errado por engano ou lançado no pedido errado. A única saída atual é sobrescrever com
outro número, o que distorce o histórico e a fila.

## What Changes

- Adicionar uma ação "Remover valor" no detalhe do pedido, disponível apenas quando o pedido já
  tem valor informado.
- Remover o valor volta o pedido ao estado "sem valor informado": fila mostra "—" e o detalhe
  mostra a mensagem de que o valor ainda não foi informado.
- A remoção fica registrada no histórico do pedido, como já ocorre para a correção de valor.

## Capabilities

### New Capabilities

(nenhuma)

### Modified Capabilities

- `admin-service-requests`: o requisito "Informar o valor do pedido" passa a permitir remover um
  valor já informado, voltando o pedido ao estado sem valor, além de informar e corrigir.

## Impact

- UI do detalhe do pedido (admin): novo controle de remover valor perto da edição de valor.
- Server action / API que grava o valor do pedido: precisa aceitar limpar o campo (null), não só
  atualizar para outro número.
- Histórico do pedido: novo tipo de entrada para remoção de valor.

## Non-Goals

- Não muda quem pode informar/corrigir valor (permanece o operador, decisão da serventia).
- Não adiciona confirmação por senha/2FA nem aprovação extra — segue o mesmo padrão de
  correção de valor já existente, sem fricção adicional.
- Não altera o formato de moeda, máscara de entrada ou a lista de andamentos.
