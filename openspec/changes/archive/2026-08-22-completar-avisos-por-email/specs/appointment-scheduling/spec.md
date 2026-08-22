## MODIFIED Requirements

### Requirement: Cancelamento pelo link do e-mail

O e-mail de confirmação SHALL conter um link de cancelamento com token de uso único, armazenado
apenas como hash. A página do link SHALL mostrar o agendamento e pedir confirmação antes de
cancelar; o cancelamento SHALL liberar o horário na oferta. Token inválido e agendamento já
cancelado ou atendido SHALL receber a mesma resposta neutra, sem revelar se o agendamento
existe. Após o cancelamento, o cidadão SHALL receber no mesmo e-mail do agendamento uma
confirmação do cancelamento, com o caminho para agendar um novo horário; o envio SHALL ser
fire-and-forget: falha de e-mail nunca desfaz nem falha o cancelamento.

#### Scenario: Cidadão cancela pelo link

- **WHEN** o cidadão abre o link do e-mail e confirma o cancelamento de um agendamento ativo
- **THEN** o agendamento passa a cancelado e o horário volta a ser oferecido na página pública

#### Scenario: Comprovante do cancelamento

- **WHEN** o cancelamento pelo link é concluído
- **THEN** chega ao e-mail do agendamento uma confirmação de que o próprio cidadão cancelou,
  sem campo de motivo, com botão para escolher um novo horário

#### Scenario: Token inválido

- **WHEN** a página de cancelamento recebe um token que não corresponde a agendamento ativo
- **THEN** a resposta é a mensagem neutra de link inválido ou expirado, sem detalhes
