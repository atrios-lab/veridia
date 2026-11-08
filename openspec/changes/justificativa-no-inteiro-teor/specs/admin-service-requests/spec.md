## ADDED Requirements

### Requirement: Motivo do pedido no detalhe
O detalhe do pedido DEVE (SHALL) mostrar e deixar editar o motivo do pedido, com o rótulo "Motivo do pedido", quando o pedido o pergunta pela regra do inteiro teor, inclusive na gratuidade com inteiro teor. O painel SHALL NOT gravar o motivo num pedido que não o pergunta.

#### Scenario: Operador corrige o motivo do inteiro teor de imóveis
- **WHEN** o operador abre um pedido de inteiro teor digital de imóveis
- **THEN** o campo "Motivo do pedido" aparece na edição, e a correção é gravada

#### Scenario: Operador troca para matrícula
- **WHEN** o operador troca a opção de um pedido de inteiro teor para matrícula e salva
- **THEN** o motivo não é gravado
