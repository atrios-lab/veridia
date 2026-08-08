## ADDED Requirements

### Requirement: Fila de pedidos de horário com status e detalhe

O painel SHALL oferecer `/admin/agenda`, atrás da permissão `channels.manage`, listando os
pedidos de horário (`kind = "appointment"`) da serventia, mais recentes primeiro, cada linha
mostrando o protocolo, o status (Pedido enviado, Proposto, Confirmado, Atendido, Cancelado), o
solicitante e a faixa pedida. O detalhe SHALL mostrar o solicitante, o contato, o assunto
informado e a faixa pedida.

#### Scenario: Faixa pedida visível na fila e no detalhe

- **WHEN** um pedido de horário foi feito para quarta, 06/08, faixa 9h–10h
- **THEN** tanto a linha da fila quanto o detalhe mostram essa data e faixa

#### Scenario: Acesso sem a permissão

- **WHEN** uma sessão sem a permissão `channels.manage` visita `/admin/agenda`
- **THEN** a rota responde como não encontrada

### Requirement: Confirmar o horário pedido

O operador SHALL poder confirmar um pedido de horário no status "Pedido enviado" ou "Proposto",
o que muda seu status para "Confirmado" e registra um evento no histórico.

#### Scenario: Confirmar muda o status

- **WHEN** o operador confirma um pedido com `status = "requested"`
- **THEN** o pedido passa para `status = "confirmed"` e um evento é registrado no histórico

### Requirement: Propor outro horário usando as faixas livres do formulário público

O operador SHALL poder propor uma faixa diferente da pedida, escolhida entre as mesmas faixas
livres que o formulário público de agendamento oferece. A proposta SHALL ficar registrada no
pedido para o cidadão escolher pela consulta de protocolo, sem mudar a faixa originalmente pedida.

#### Scenario: Faixas oferecidas são as mesmas do formulário público

- **WHEN** o operador abre o seletor de "Propor outro horário"
- **THEN** as faixas oferecidas refletem a mesma ocupação (`appointmentOccupancy`) que o
  formulário público usa para calcular faixas livres

#### Scenario: Propor outro horário não apaga a faixa original

- **WHEN** o operador propõe quinta, 07/08, faixa 11h–12h para um pedido originalmente feito para
  quarta, 06/08, faixa 9h–10h
- **THEN** o pedido passa para `status = "proposed"`, a faixa proposta fica registrada, a faixa
  originalmente pedida continua visível, e um evento é registrado no histórico

### Requirement: Cancelar pedido e marcar como atendido

O operador SHALL poder cancelar um pedido de horário em qualquer status não terminal, e marcar
como atendido um pedido confirmado, cada ação registrando um evento no histórico.

#### Scenario: Cancelar um pedido

- **WHEN** o operador cancela um pedido com `status = "requested"` ou `"confirmed"`
- **THEN** o pedido passa para `status = "cancelled"` e um evento é registrado no histórico

#### Scenario: Marcar como atendido após realizado

- **WHEN** o operador marca como atendido um pedido com `status = "confirmed"`
- **THEN** o pedido passa para `status = "done"` e um evento é registrado no histórico

### Requirement: Contador de pedidos de horário em aberto na sidebar

O painel SHALL mostrar, no item "Agenda de atendimentos" da sidebar, a quantidade de pedidos de
horário com status diferente de `"done"` e `"cancelled"` da serventia.

#### Scenario: Contador soma pedido enviado, proposto e confirmado

- **WHEN** a serventia tem 1 pedido `requested`, 1 `proposed`, 1 `confirmed` e 2 `done`
- **THEN** o contador ao lado de "Agenda de atendimentos" mostra 3
