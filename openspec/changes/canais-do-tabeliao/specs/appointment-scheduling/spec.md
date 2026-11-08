## ADDED Requirements

### Requirement: O cidadão escolhe o canal do tabelião e sabe como se preparar

Na agenda do tabelião, o formulário SHALL oferecer só os canais do dia escolhido, com o que
cada um significa, e o servidor SHALL recusar outro. Num atendimento por vídeo ou ligação, a
confirmação, o e-mail e o comprovante SHALL dizer como estar disponível no horário, em vez do
aviso de chegar 15 minutos antes, e SHALL chamar a lista de "O que ter em mãos".

#### Scenario: Agendamento por ligação

- **WHEN** o cidadão agenda com o tabelião "Por ligação" às 14:00
- **THEN** a confirmação diz que às 14:00 o tabelião liga no telefone informado
- **AND** o comprovante não tem a linha "Chegada"
