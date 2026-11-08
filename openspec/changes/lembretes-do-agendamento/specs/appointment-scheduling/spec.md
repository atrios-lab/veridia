## ADDED Requirements

### Requirement: Lembrete ao cidadão na véspera

Cada agendamento ativo com e-mail SHALL receber um lembrete na véspera, com dia, hora, local,
aviso de chegada ou de como estar disponível, lista do que levar e o e-mail da serventia para
dúvidas. O lembrete SHALL sair uma vez só, mesmo que a tarefa rode mais de uma vez, e nunca
para um agendamento cancelado.

#### Scenario: Tarefa roda duas vezes

- **WHEN** a tarefa diária roda duas vezes no mesmo dia
- **THEN** cada cidadão de amanhã recebe um lembrete só
