## ADDED Requirements

### Requirement: Agenda só nos dias de atendimento de fato

As agendas SHALL ficar fechadas nos feriados (nacionais, estaduais e os do cartório, inclusive os
adicionados depois), no site e no balcão. O painel SHALL mostrar o feriado na faixa de dias e
SHALL avisar sobre agendamentos já marcados em dia que deixou de ter atendimento, sem cancelá-los
sozinho.

#### Scenario: Feriado cadastrado depois do agendamento

- **WHEN** o cartório cadastra um feriado numa data que já tem agendamentos
- **THEN** o site deixa de oferecer a data, o painel avisa ao salvar quantos agendamentos caem nela
  e a agenda os lista em "Agendados em dia sem atendimento", com link para o dia

#### Scenario: Dia de feriado na faixa

- **WHEN** a semana mostrada tem um feriado
- **THEN** a faixa mostra o dia como "Feriado", fechado, e o dia mostra o nome do feriado e não
  oferece reserva no balcão
