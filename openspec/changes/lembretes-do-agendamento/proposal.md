## Why

Ninguém era lembrado de um agendamento: o funcionário só via se abrisse a agenda, o cidadão
só tinha o e-mail da confirmação e o cartório não recebia nada quando alguém agendava pelo
site.

## What Changes

- **Painel:** avisos em qualquer tela para quem cuida da agenda: "Novo agendamento pelo site"
  (com som e notificação do navegador, se autorizada), "Às 09:00: <nome>" quinze minutos antes
  de cada atendimento, e "Hoje: N agendamentos" no início do dia. Cada aviso fecha à mão e
  continua fechado no computador. O número ao lado de "Agenda de atendimentos" passa a contar
  os agendamentos de hoje em diante (antes lia um tipo antigo e ficava em zero).
- **Cidadão:** lembrete por e-mail na véspera, com dia, hora, local, aviso de chegada (ou como
  estar disponível no vídeo e na ligação), lista do que levar e o e-mail para dúvidas.
- **Cartório:** e-mail a cada agendamento feito pelo site e, na véspera, um e-mail com a agenda
  do dia seguinte, no e-mail de contato da serventia.
- **Envio:** tarefa diária da Vercel às 10h (`/api/agenda/lembretes`, protegida por
  `CRON_SECRET`) e, como reserva, o painel ao ser aberto. Cada lembrete é reservado no mesmo
  comando que o marca, então sai uma vez só.

## Banco

Só acrescenta: `appointments.reminder_sent_at` (migração 0034). O resumo do cartório usa uma
linha em `tenant_content` (`agenda-reminders`). Nada é apagado.

## Não-objetivos

- Lembrete por WhatsApp ou SMS.
- Link de cancelamento no lembrete: o token que cancela está só no e-mail de confirmação.
