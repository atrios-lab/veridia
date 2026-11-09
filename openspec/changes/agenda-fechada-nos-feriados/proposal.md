## Why

A agenda já não oferecia feriados no site, mas o painel não dizia que o dia era feriado: a faixa
de dias pulava a data sem aviso. E um feriado cadastrado depois deixava os agendamentos já
marcados naquele dia sem ninguém saber, com o cidadão contando com um atendimento que não vai
acontecer.

## What Changes

- **Só nos dias de atendimento de fato**: feriados nacionais, estaduais e os do cartório (os já
  cadastrados e os que forem adicionados) fecham as duas agendas no site e no balcão. Isso já
  valia e agora tem teste.
- **Faixa de dias do painel**: mostra o feriado como "Feriado", fechado, em vez de pular a data.
- **Dia de feriado no painel**: cartão "Sem atendimento neste dia" com o nome do feriado; o balcão
  não reserva.
- **Agendados em dia sem atendimento**: a agenda lista os agendamentos ainda marcados em dia que
  virou feriado (ou ficou fechado, ou sem horários), com link para o dia, para remarcar ou
  cancelar.
- **Ao salvar os feriados**: se algum agendamento cair num dia que agora não tem atendimento, o
  painel avisa quantos e leva para a agenda.
- Nada é cancelado sozinho e o banco não muda.
