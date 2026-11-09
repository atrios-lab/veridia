## ADDED Requirements

### Requirement: Vários cidadãos no mesmo horário

O site SHALL oferecer um horário enquanto houver vaga nele, na agenda escolhida, e SHALL recusar o
agendamento quando todas as vagas forem tomadas, inclusive quando dois cidadãos disputam a última
vaga ao mesmo tempo.

#### Scenario: Horário com 3 vagas

- **WHEN** três cidadãos marcam 08:00 num horário de 3 vagas
- **THEN** os três ficam agendados e o quarto encontra o horário cheio
