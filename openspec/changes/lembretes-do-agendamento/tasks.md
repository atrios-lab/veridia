## 1. Regras e banco

- [x] 1.1 `core/scheduling/reminders.ts`: dia do lembrete e textos dos e-mails; testes
- [x] 1.2 Migração 0034: `appointments.reminder_sent_at` (só acrescenta)
- [x] 1.3 Reserva do lembrete e do resumo, uma vez cada; testes contra PGlite

## 2. Envio

- [x] 2.1 `/api/agenda/lembretes` com `CRON_SECRET` e tarefa diária em `vercel.json`
- [x] 2.2 Reserva no painel ao abrir, no máximo a cada 10 minutos
- [x] 2.3 E-mail ao cartório a cada agendamento pelo site

## 3. Painel

- [x] 3.1 Avisos: novo agendamento, chegando em 15 minutos, agendamentos do dia
- [x] 3.2 Número da agenda conta os agendamentos de hoje em diante

## 4. Verificação

- [x] 4.1 Bateria do CI
- [x] 4.2 Navegador e tarefa: aviso no painel, e-mail ao cartório, lembrete e resumo uma vez só
