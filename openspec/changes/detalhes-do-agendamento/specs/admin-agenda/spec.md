## ADDED Requirements

### Requirement: Detalhes do agendamento

O painel SHALL abrir os detalhes de cada agendamento: o que o cliente informou e enviou, anotações
internas, anexos da serventia e os dados do cliente para corrigir. Anotações e anexos da serventia SHALL
ficar fora da consulta do cliente.

#### Scenario: Corrigir o nome digitado errado

- **WHEN** o funcionário abre os detalhes de um agendamento e corrige o nome e o CPF
- **THEN** o agendamento passa a mostrar os dados corrigidos, no mesmo dia e horário, e a correção fica na
  auditoria

#### Scenario: Anexo interno

- **WHEN** o funcionário anexa um arquivo nos detalhes
- **THEN** o arquivo aparece no painel e não aparece na consulta do cliente
