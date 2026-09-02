## MODIFIED Requirements

### Requirement: Informar o valor do pedido

O operador SHALL poder informar o valor do pedido, em reais, quando ele ainda não tiver sido
informado, SHALL poder corrigi-lo depois de já informado, e SHALL poder removê-lo, voltando o
pedido ao estado sem valor informado. Um pedido sem valor informado SHALL mostrar "—" na fila e
a mensagem de que o valor ainda não foi informado no detalhe.

#### Scenario: Informar valor pela primeira vez

- **WHEN** o operador informa R$ 62,10 num pedido sem valor
- **THEN** o pedido passa a mostrar R$ 62,10 na fila e no detalhe

#### Scenario: Corrigir valor já informado

- **WHEN** o operador altera um valor já informado
- **THEN** o novo valor substitui o anterior e a mudança fica registrada no histórico

#### Scenario: Remover valor já informado

- **WHEN** o operador aciona "Remover valor" num pedido que já tem valor informado
- **THEN** o pedido volta a mostrar "—" na fila e a mensagem de valor não informado no detalhe, e
  a remoção fica registrada no histórico

#### Scenario: Remover não aparece sem valor informado

- **WHEN** o detalhe do pedido não tem valor informado
- **THEN** a ação "Remover valor" não é oferecida
