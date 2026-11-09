## ADDED Requirements

### Requirement: Desfazer e excluir agendamento

O painel SHALL permitir desfazer a marcação de atendido ou não compareceu, voltando o agendamento
para agendado, e SHALL permitir excluir um agendamento em qualquer situação. Excluir SHALL tirar
o agendamento da agenda e liberar o horário sem apagar o registro do banco.

#### Scenario: Marcou atendido sem querer

- **WHEN** a operadora marca "Atendido" por engano e clica em "Desfazer"
- **THEN** o agendamento volta para "Agendado", com os botões de marcar de novo

#### Scenario: Excluir atendido

- **WHEN** a operadora exclui um agendamento marcado como atendido e confirma
- **THEN** ele sai da agenda, o horário fica livre no site e o registro continua guardado no banco
