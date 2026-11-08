## ADDED Requirements

### Requirement: Declaração de comparecimento para atendimento presencial

Para um agendamento presencial marcado como atendido, o painel SHALL emitir a declaração de
comparecimento em PDF com "República Federativa do Brasil", o timbre, o nome e o CNS da serventia, o
nome e o CPF do cidadão, o dia e o horário, o fundamento (Lei 8.935/1994, arts. 3º, 20 e 30,
II), a gratuidade, a cidade e a data, a linha de assinatura "Tabelião / Substituto /
Escrevente Autorizado" com espaço para carimbo, e o QR Code e o código de validação. A
declaração SHALL NOT dizer o assunto do atendimento. O comprovante de um atendido SHALL trazer
a declaração junto. Para um agendamento não atendido, por vídeo ou por ligação, SHALL ser
recusada.

#### Scenario: Atendente emite a declaração

- **WHEN** o atendente marca "Atendido" e escolhe "Declaração de comparecimento"
- **THEN** abre o PDF da declaração, pronto para assinar e carimbar
