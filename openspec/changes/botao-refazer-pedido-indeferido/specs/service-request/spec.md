## ADDED Requirements

### Requirement: Ação de refazer pedido no desfecho negativo

Quando o desfecho exibido na consulta pública `/acompanhar` é "Indeferido" ou "Cancelado", a consulta SHALL oferecer um botão que leva o cidadão diretamente para `/solicitar`, em vez de orientá-lo a buscar outro canal de atendimento (online ou balcão) para dúvidas.

#### Scenario: Botão de refazer pedido substitui a orientação de contato no Indeferido
- **WHEN** o cidadão consulta um pedido com desfecho "Indeferido"
- **THEN** o card de instruções curtas exibe um botão "Refazer pedido" que leva a `/solicitar`, e não exibe mais a orientação para falar com o atendimento online ou no balcão

#### Scenario: Botão de refazer pedido substitui a orientação de contato no Cancelado
- **WHEN** o cidadão consulta um pedido com desfecho "Cancelado"
- **THEN** o card de instruções curtas exibe um botão "Refazer pedido" que leva a `/solicitar`, e não exibe mais a orientação para falar com o atendimento online ou no balcão
