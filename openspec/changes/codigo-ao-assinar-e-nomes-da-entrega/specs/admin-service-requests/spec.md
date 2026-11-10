## ADDED Requirements

### Requirement: Nome do documento entregue

O painel SHALL permitir dar nome a cada documento entregue ao cidadão, com sugestões a partir do ato e do
protocolo, e SHALL usar um nome padrão numerado com o protocolo quando nenhum for informado. O cidadão SHALL
ver o nome dado.

#### Scenario: Sem nome

- **WHEN** o funcionário entrega o segundo documento do pedido sem informar nome
- **THEN** o documento aparece como "Documento final 2 · " seguido do protocolo

#### Scenario: Renomear

- **WHEN** o funcionário renomeia um documento entregue
- **THEN** o painel e a consulta do cidadão passam a mostrar o novo nome
