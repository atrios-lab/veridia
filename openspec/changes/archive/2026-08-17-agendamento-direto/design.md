# Design — agendamento direto

## Context

O agendamento atual é um `service_request` de kind `appointment`: protocolo AGD, chave hasheada,
statuses `requested → proposed/confirmed → done`, contraproposta no painel e aceite na consulta
por protocolo. A grade é uma janela fixa em código (`scheduling: { startHour, endHour,
capacityPerSlot }` no tenant), igual para todo dia útil. A referência real do cliente era o
Calendly: grade semanal publicada pela serventia, um cidadão por horário, confirmação imediata
por e-mail com link de cancelamento. A infraestrutura de e-mail (Resend, cartão com identidade
do tenant) já existe em `src/lib/email/`.

## Goals / Non-Goals

**Goals:**

- Agendamento imediato: horário livre pego é horário confirmado; some da oferta.
- Grade sob controle da serventia no painel: dias da semana, horários de início, lista de
  serviços e modos de atendimento.
- E-mail como único canal: confirmação (com `.ics` e link de cancelamento), cancelamento
  individual e fechamento de dia com motivo.
- Unicidade garantida pelo banco, não por contagem em aplicação.

**Non-Goals:**

- Duração por serviço, agendas paralelas, remarcação, lembretes, feriados municipais,
  múltiplas vagas por horário (ver não-objetivos da proposta).

## Decisions

### Tabela própria `appointments`, fora de `service_requests`

Sem protocolo, chave, anexos ou fases, o agendamento não compartilha mais nada com o
guarda-chuva de pedidos. Tabela enxuta: `id, tenantSlug, date (IsoDate), slotTime ("HH:mm"),
citizenName, email, phone, cpf?, serviceId, serviceLabel, mode, status ('booked' | 'cancelled' |
'attended'), cancelReason?, cancelTokenHash, createdAt, updatedAt`.

- **Unicidade**: índice único parcial em `(tenantSlug, date, slotTime) WHERE status <> 'cancelled'`.
  Dois cidadãos correndo pelo mesmo horário: um grava, o outro recebe o erro e a tela reoferece.
  Substitui todo o maquinário de `capacityPerSlot`/ocupação.
- **Só cancelado libera a faixa.** "Ocupa o horário" e "ainda dá para agir" são perguntas
  diferentes: um atendimento já realizado gastou aquela hora do balcão e continua ocupando-a,
  mas não pode mais ser cancelado. A primeira versão indexava só `booked`, e marcar como
  atendido um cidadão que chegou cedo devolvia a faixa dele à venda — bug encontrado na
  verificação e travado por `src/db/appointments.test.ts`.
- `serviceLabel` gravado junto do `serviceId`: a lista de serviços é editável, e o registro tem
  de sobreviver a renomeação — mesmo racional do catálogo de atos.
- Alternativa rejeitada: continuar em `service_requests` com kind próprio. Herdaria protocolo,
  sequência AGD e consulta — exatamente o que a mudança remove.

### Link de cancelamento com token hasheado

O e-mail de confirmação leva `/agendar/cancelar?token=...`; o banco guarda só o hash (mesmo
helper das chaves de acesso). Página GET mostra o agendamento e pede confirmação; o POST
cancela. Token inválido ou agendamento já não-`booked` respondem a mesma mensagem neutra.
Alternativa rejeitada: token em claro no banco — hashear é uma linha e segue o padrão da casa.

### Configuração da agenda em `tenant_content`, chave `office-agenda`

Segue o padrão de `office-chat`: estado operacional lido direto por `src/lib/`, **não** merged
em `applyTenantOverrides` (a grade não é marca nem conteúdo editorial). Payload validado por Zod
no core:

```
{
  grid:     { "1": ["08:30","09:00"], "4": ["08:30","13:30"] },   // weekday → start times
  services: [{ id, label }],                                       // "Tabelião" é um item
  modes:    ["Presencial", "On-line", ...],                        // editável; drive-thru é
  closedDates: [{ date, reason }]                                  // realidade de um cartório,
}                                                                  // não vira código
```

- `closedDates` bloqueia a oferta da data **e** registra o motivo; o fechamento cancela os
  agendamentos vivos da data (e-mail a cada um) na mesma ação do painel.
- Modos editáveis por serventia porque "drive-thru" é particularidade de um cartório; hardcodar
  violaria o princípio de configuração-nunca-fork. Seed com `["Presencial", "On-line"]`.
- `scheduling` **não** sai de `src/core/tenant/schema.ts`: descoberto na implementação que
  `isWithinChatHours`/`nextChatOpening` e a linha "Aberto agora" da página de contato leem
  dele, e a spec `support-chat` amarra o horário do chat ao horário de atendimento. O campo
  é renomeado para `counterHours` e perde `capacityPerSlot` (esse sim, exclusivo do
  agendamento). São conceitos distintos: o balcão abre todo dia, a agenda pode receber só
  às terças — conflatar os dois quebraria o chat.
- Alternativa rejeitada: tabelas relacionais para grade/serviços. Duas listas curtas editadas
  por um formulário só; JSON validado no core basta e evita três migrações.

### Core puro reescrito em cima de "grade + tomados"

`src/core/scheduling/slots.ts` passa a operar com a grade configurada e o conjunto de horários
tomados do dia: `freeSlots(grid, weekday, taken, nowCutoff?)`. O calendário de dias úteis
(`calendar.ts`) permanece intacto; dias oferecidos = dias úteis ∩ dias com grade ∩ não
fechados. Horários de hoje já passados não são oferecidos (cutoff calculado com o relógio de
parede da serventia, passado pelo caller — o core continua sem ler relógio).

### Formulário: nome, e-mail e telefone obrigatórios; CPF opcional

E-mail é o canal de confirmação (obrigatório por construção). Telefone é o fallback humano da
serventia. CPF fica opcional: minimização LGPD — muitos atendimentos nem precisam dele.
Honeypot anti-robô mantido do formulário atual; sem CAPTCHA.

### Statuses mínimos e ações do painel

`booked → attended | cancelled`. O painel (`/admin/agenda`) vira agenda do dia: lista por data
com serviço/modo/contato, ações de marcar atendido e cancelar com motivo (e-mail), mais o
fechamento de dia (motivo + cancelamento em lote + `closedDates`). Confirmar e propor deixam de
existir. Toda ação de escrita re-checa permissão no servidor e grava `audit_log`.

## Risks / Trade-offs

- [Agendamentos vivos no modelo antigo no dia do deploy] → Sem migração de dados: o volume é
  de dígito único ou zero (módulo recém-lançado). Antes do deploy, conferir com uma query os
  `appointment` vivos com data futura e a serventia resolve cada um pelo contato registrado.
  As rows antigas ficam dormentes em `service_requests` até o contract.
- [Cidadão sem e-mail não agenda pelo site] → Aceito por decisão: a tela mostra telefone e
  WhatsApp da serventia; o balcão continua agendando por fora.
- [Serventia esquece de configurar a grade] → Sem grade configurada a página pública mostra o
  estado vazio com os contatos ("agende pelo telefone"), nunca uma grade inventada por default.
- [Fechar dia dispara N e-mails em sequência] → N é pequeno (horários de um dia); envio
  sequencial com falhas logadas, sem fila. Se um e-mail falhar, o cancelamento já valeu — o
  painel mostra o dia fechado e a serventia tem o telefone do cidadão.
- [Corrida pelo último horário] → O índice único decide; o perdedor recebe mensagem clara e a
  grade recarregada. Sem lock em aplicação.

## Migration Plan

1. **Expand (este change)**: cria `appointments`; público e painel passam a operar no modelo
   novo; ramo de agendamento sai da consulta por protocolo; kind `appointment` deixa de ser
   criado. Nada é dropado.
2. **Contract (change futuro)**: remover suporte ao kind `appointment` em
   `src/core/request/kinds.ts` e limpar rows dormentes — só depois de confirmado que nenhum
   registro vivo importa.

Rollback do deploy 1: reverter o código; a tabela nova fica vazia e inofensiva.

## Open Questions

- Nenhuma. As decisões de produto foram fechadas na exploração com o cliente (agenda única,
  "Tabelião" como serviço, 1 por horário, e-mail obrigatório).
