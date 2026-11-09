## ADDED Requirements

### Requirement: Validação pública da declaração de comparecimento

O site da serventia SHALL validar a declaração pelo endereço do QR Code: com o código certo e
o atendimento marcado como atendido, SHALL mostrar "Declaração válida", a serventia, o nome
abreviado, o dia e o horário; com código errado ou atendimento não confirmado, SHALL mostrar
"Declaração não encontrada".

#### Scenario: Empregador confere a declaração

- **WHEN** alguém lê o QR Code de uma declaração emitida
- **THEN** o site da serventia mostra "Declaração válida" com o dia e o horário do comparecimento

#### Scenario: Código alterado

- **WHEN** alguém altera o código no endereço
- **THEN** o site mostra "Declaração não encontrada"
