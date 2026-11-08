## ADDED Requirements

### Requirement: O cartório confirma se a pessoa foi atendida

Depois que o horário de um agendamento termina e ele continua agendado, o painel SHALL
perguntar, em qualquer tela, se a pessoa foi atendida, com "Atendido" e "Não compareceu"
ali mesmo e a opção de responder depois. A agenda do dia SHALL marcar esses agendamentos e
listar os que aguardam confirmação nos últimos 30 dias. Um agendamento marcado SHALL deixar de
ser perguntado.

#### Scenario: Atendimento que já passou

- **WHEN** termina o horário de um agendamento que ninguém marcou
- **THEN** o painel mostra "<nome> foi atendido?" com "Atendido" e "Não compareceu"

#### Scenario: Cartório responde

- **WHEN** o funcionário escolhe "Não compareceu"
- **THEN** o agendamento fica como falta e sai do aviso e da lista de pendentes
