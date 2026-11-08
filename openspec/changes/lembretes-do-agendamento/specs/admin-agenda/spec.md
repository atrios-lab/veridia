## ADDED Requirements

### Requirement: O painel lembra o funcionário dos agendamentos

Para quem tem a permissão da agenda, o painel SHALL avisar, em qualquer tela, de cada
agendamento novo feito pelo site, do cidadão que chega nos próximos 15 minutos e dos
agendamentos do dia. Cada aviso SHALL fechar à mão e continuar fechado naquele computador. O
item "Agenda de atendimentos" SHALL mostrar quantos agendamentos há de hoje em diante.

#### Scenario: Agendamento pelo site com o painel aberto

- **WHEN** um cidadão agenda pelo site enquanto o funcionário usa o painel
- **THEN** aparece "Novo agendamento pelo site" com o nome, o dia, a hora e a agenda, e "Ver na agenda"

### Requirement: O cartório recebe os agendamentos por e-mail

A serventia SHALL receber, no e-mail de contato, um aviso de cada agendamento feito pelo site
e, na véspera, um e-mail com os agendamentos do dia seguinte, uma vez por dia.

#### Scenario: Véspera de um dia com agendamentos

- **WHEN** a tarefa diária roda e o dia seguinte tem agendamentos
- **THEN** o cartório recebe "Agenda de <dia>: N agendamentos", em ordem de horário, e uma segunda execução não envia de novo
