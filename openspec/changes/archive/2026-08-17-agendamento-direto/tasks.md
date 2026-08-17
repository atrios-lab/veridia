# Tasks — agendamento direto

## 1. Núcleo puro (src/core)

- [x] 1.1 Definir em `src/core/scheduling/` o schema Zod da configuração da agenda
      (`grid` por dia da semana com horários "HH:mm", `services`, `modes`, `closedDates`
      com motivo) e os defaults de seed (`modes: ["Presencial", "On-line"]`)
- [x] 1.2 Reescrever `slots.ts` sobre grade + tomados: dias oferecidos (dias úteis ∩ grade ∩
      não fechados), horários livres do dia com cutoff do dia corrente, próximo dia com vaga;
      remover `SchedulingWindow`/`capacityPerSlot`/`Occupancy`
- [x] 1.3 Atualizar testes em `scheduling.test.ts` para o modelo novo (incluindo grade vazia,
      dia fechado e cutoff de horário passado)
- [x] 1.4 Renomear `scheduling` para `counterHours` em `src/core/tenant/schema.ts` e nos
      tenants, derrubando só `capacityPerSlot`. O campo não pôde ser removido: o horário do
      chat e a linha "Aberto agora" leem dele, e a spec do chat amarra os dois
- [x] 1.5 Atualizar `ics.ts` para o evento com horário pontual e serviço no corpo

## 2. Banco e acesso a dados

- [x] 2.1 Criar tabela `appointments` em `src/db/schema.ts` (campos do design; índice único
      parcial em tenant+date+slotTime WHERE status='booked') e gerar a migração Drizzle
- [x] 2.2 Criar `src/lib/appointments.ts`: gravar agendamento (traduzindo violação de unicidade
      em "horário acabou de ser preenchido"), horários tomados por faixa de dias, listar por
      dia, cancelar (individual e em lote por data), marcar atendido, buscar por hash de token
- [x] 2.3 Ler/gravar a configuração da agenda em `tenant_content` chave `office-agenda`
      (padrão de `office-chat`), validada pelo schema do core
- [x] 2.4 Remover `appointmentOccupancy` e `proposeAppointmentSlot` de
      `src/lib/service-request.ts` (rows antigas ficam dormentes até o contract)

## 3. E-mails

- [x] 3.1 Criar `src/lib/email/appointment.ts` com os três e-mails sobre o cartão existente:
      confirmação (dia, horário, serviço, modo, endereço, link de cancelar, `.ics`),
      cancelamento individual com motivo, fechamento de dia com motivo
- [x] 3.2 Falha de envio no fechamento em lote não desfaz cancelamentos; logar cada falha

## 4. Página pública /agendar

- [x] 4.1 Adaptar `page.tsx` para grade configurada + tomados; estado vazio com contatos
      quando não há grade
- [x] 4.2 Adaptar o formulário: campos nome, e-mail e telefone obrigatórios, CPF opcional,
      selects de serviço e modo vindos da config; manter honeypot; remover aviso de pedido
- [x] 4.3 Reescrever a action de envio: gravar direto como `booked`, gerar token de
      cancelamento (hash no banco), enviar e-mail de confirmação; corrida devolve grade
      atualizada
- [x] 4.4 Tela de confirmação sem protocolo/chave: dia, horário, aviso do e-mail enviado,
      atalho do `.ics`
- [x] 4.5 Criar página de cancelamento por token (`/agendar/cancelar`): GET mostra e pede
      confirmação, POST cancela e libera o horário; resposta neutra para token inválido
- [x] 4.6 Remover o ramo de agendamento da consulta por protocolo (`/protocolo`, bloco
      "É a sua vez" e aceite de proposta)

## 5. Painel /admin/agenda

- [x] 5.1 Refazer a listagem como agenda do dia (horário, nome, serviço, modo, contato,
      estado), lendo de `appointments`
- [x] 5.2 Ações com `channels.manage` re-checado e `audit_log`: marcar atendido, cancelar com
      motivo obrigatório + e-mail; remover confirmar/propor e `propose-slot-picker`
- [x] 5.3 Fechar dia: motivo obrigatório, cancela vivos da data em lote, envia e-mails,
      grava `closedDates`
- [x] 5.4 Configuração da agenda no painel (grade semanal por dia da semana, lista de
      serviços, lista de modos), salvando em `office-agenda`

## 6. Limpeza e verificação

- [x] 6.1 Varrer referências mortas: statuses `requested`/`proposed` de appointment, AGD na
      geração de protocolo público, overview/desk que contava pedidos de agendamento
- [x] 6.2 Atualizar e2e (público e painel) e rodar `pnpm` build, testes e Biome: 331 testes,
      build e lint limpos
- [x] 6.3 Query pré-deploy em `scripts/pending-legacy-appointments.ts`: lista os `appointment`
      vivos com data futura em `service_requests` para a serventia resolver pelo contato
