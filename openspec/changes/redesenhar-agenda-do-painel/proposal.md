## Why

A serventia aprovou mockups novos para as duas telas da agenda no painel. Hoje a agenda do dia
é uma tabela de agendamentos sem contexto (não mostra os horários livres, não mostra a semana,
não diz o que o site está oferecendo), e a configuração é texto livre "HH:mm, HH:mm" que exige
formato de cabeça. Os mockups trazem a semana visível, os horários livres com reserva no
balcão, falta do cidadão, protocolo por agendamento, grade por chips com seletor de hora,
"só com o tabelião" por serviço e prévia ao vivo do que o cidadão vê.

## What Changes

Agenda do dia (`/admin/agenda`):

- Régua de dias úteis (7 por página, sem sábado/domingo) com ocupação "X de Y" por dia, "hoje"
  e "Fechado"; setas paginam a régua sem perder o dia selecionado.
- A lista do dia passa a mostrar **todos** os horários da grade: agendados (com protocolo,
  contato, serviço · modo) e livres ("Livre — aparece no site para agendamento").
- Horário livre ganha "Reservar para um cidadão": a serventia registra um agendamento de
  balcão (origem `desk`, badge "Reservado no balcão"); com e-mail informado, o cidadão recebe
  a mesma confirmação do site.
- Nova ação "Faltou": status `no_show`, auditado, sem e-mail.
- Agendamento ganha protocolo `AGD.AAAA.NNNNNN` (mesma numeração anual por serventia dos demais
  canais), consultável na página pública de protocolo.
- Barra lateral: cartão permanente "Configurar horários, serviços e modos" (absorve a change
  `abrir-caminho-para-configurar-agenda`), cartão "Fechar este dia" e cartão "Dias fechados à
  frente" com "Reabrir" por data.

Configuração (`/admin/agenda/configuracao`):

- Grade por chips com `<input type="time">` para adicionar, "×" para remover e "Copiar de
  segunda"; por dia, "N cidadãos/dia" ou "Não aparece no site".
- Remover horário com agendamento futuro pede confirmação; os agendamentos existentes seguem
  valendo (regra já especificada — ver design).
- Serviços em lista com alternador "Só com o tabelião" (novo campo `notaryOnly`); o formulário
  público do cidadão passa a anunciar a marca antes da escolha.
- Modos de atendimento como cartões marcáveis com descrição (modos conhecidos), preservando
  modos já configurados fora da lista conhecida.
- Prévia ao vivo "Como o cidadão vê", calculada do estado ainda não salvo, com horários
  ocupados riscados.
- Barra fixa "Alterações não salvas" com Descartar e Salvar agenda.
- Cabeçalho do painel ganha retorno "‹ Agenda" (prop opcional no `AdminPageHeader`).

### Não-objetivos

- Nada muda no fluxo público de **marcar** (dias oferecidos, corrida pelo horário, e-mails).
- Sem shadcn nem dependência nova: tudo com os tokens `admin-*` existentes.
- Remover horário da grade continua **não** cancelando agendamentos (spec vigente); o texto do
  mockup "avisa o cidadão" vira aviso ao operador na confirmação.
- Modos continuam strings livres no schema; sem tabela nova.
- Sem duração por serviço, sem múltiplos cidadãos por horário.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `admin-agenda`: agenda do dia com régua semanal, horários livres visíveis, reserva de balcão,
  falta, protocolo exibido, fechados à frente; configuração estruturada com prévia; caminho
  permanente para a configuração.
- `appointment-scheduling`: agendamento recebe protocolo AGD consultável; serviço "só com o
  tabelião" anunciado ao cidadão no formulário.

## Impact

- Migração expand: `appointments` ganha `origin`, `protocol_year`, `protocol_sequence`,
  `protocol_number` (todas com default/null; nada destrutivo).
- `src/core/scheduling/{appointment,agenda}.ts`, `src/core/overview/desk.ts`.
- `src/lib/appointments.ts`, `src/lib/admin-overview.ts`.
- Telas e ações em `src/app/admin/(dashboard)/agenda/**`, `AdminPageHeader`.
- Público: anotação no select de serviços do `/agendar`; consulta `AGD` em `/protocolo`.
- e2e `admin-agenda.spec.ts` e testes do núcleo.
