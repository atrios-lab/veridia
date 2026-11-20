## ADDED Requirements

### Requirement: Editar e apagar a devolução do requerimento

A devolução do requerimento assinado SHALL ter as opções "Editar motivo" e "Apagar devolução". Editar SHALL trocar o texto que o solicitante lê e SHALL guardar o texto anterior no histórico do pedido. Apagar SHALL pedir confirmação e SHALL voltar o arquivo para "a conferir". Nenhuma das duas opções SHALL remover dados do banco, e ambas SHALL ser registradas na auditoria.

#### Scenario: Corrigir o motivo
- **WHEN** o funcionário edita o motivo de uma devolução
- **THEN** o solicitante lê o texto novo, e o "Histórico da devolução" mostra o texto anterior

#### Scenario: Apagar a devolução por engano
- **WHEN** o funcionário confirma "Apagar devolução"
- **THEN** o requerimento volta para "a conferir", o motivo sai da consulta do solicitante e o texto fica no histórico
