## Why

Uma serventia com 20 atendentes começa a atender às 08:00 com 20 pessoas ao mesmo tempo, mas a
agenda só aceitava um agendamento por horário: era preciso inventar 08:00, 08:01, 08:02... E
montar a grade (quem atende o quê, quando, com almoço em turnos) era feito à mão.

## What Changes

- **Vagas por horário**: cada horário de cada dia da semana tem um número de vagas (quantas
  pessoas atendem ao mesmo tempo). Sem número, uma vaga, como antes. No painel, o horário mostra
  "×20" e o editor do horário tem o campo "Vagas". Copiar o dia leva as vagas junto.
- **Marcação**: site e balcão contam as vagas livres do horário na agenda escolhida. Uma trava por
  horário no banco (`pg_advisory_xact_lock`) impede que dois cidadãos fiquem com a última vaga;
  cada agendamento ocupa uma vaga numerada (`seat`), e as duas agendas passam a ter horários
  independentes.
- **Agenda do dia**: mostra todos os agendamentos do horário e "Livre: N vagas"; a faixa de dias e
  o cabeçalho contam vagas, não horários.
- **Montar a grade automaticamente**: o cartório informa abertura, término, quantas pessoas
  atendem, almoço em turnos (janela e duração) e o tempo de cada serviço, marcando os rápidos. O
  sistema monta o dia de cada pessoa, intercalando os rápidos entre os longos, revezando o almoço
  sem fechar o atendimento, e mostra os horários com as vagas e os serviços. "Usar esta grade"
  preenche os dias marcados; nada muda no site antes de salvar.

## ⚠️ Banco

Migração `0037_vagas_por_horario`:
- acrescenta `appointments.seat` (inteiro, padrão 1; todas as linhas existentes ficam na vaga 1);
- cria o índice único `appointments_tenant_date_slot_seat_live` (por vaga);
- **remove** o índice único `appointments_tenant_date_slot_live` (um por horário).

Nenhuma linha é apagada, mas uma estrutura do banco sai: pela regra do projeto, este PR fica
aberto para revisão humana. Para desfazer: remover o índice novo e recriar o antigo (só funciona se
nenhum horário tiver dois agendamentos vivos).
