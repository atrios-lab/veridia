## ADDED Requirements

### Requirement: Horário restrito a alguns serviços

O site SHALL indicar no horário restrito os serviços que ele atende e, escolhido o horário,
SHALL oferecer só esses serviços. O servidor SHALL recusar o agendamento de um serviço que o
horário não atende.

#### Scenario: Cidadão escolhe 08:30

- **WHEN** 08:30 de segunda atende só reconhecimento de firma e o cidadão escolhe esse horário
- **THEN** o horário mostra "Só Reconhecimento de firma" e a lista de serviços traz só esse serviço

#### Scenario: Pedido burlado

- **WHEN** chega ao servidor um agendamento às 08:30 de segunda para outro serviço
- **THEN** o agendamento é recusado com "Às 08:30, a serventia atende só: Reconhecimento de firma."
