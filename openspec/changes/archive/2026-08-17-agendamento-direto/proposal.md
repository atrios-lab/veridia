# Agendamento direto

## Why

O agendamento hoje é um pedido: o cidadão escolhe uma faixa e espera a serventia confirmar ou
contrapropor, com protocolo e chave para acompanhar. O cartório que inspirou o módulo operava no
modelo oposto (Calendly): a serventia publica os horários que atende, o cidadão pega um horário
livre e pronto — confirmação na hora, por e-mail, sem protocolo. O tabelião pediu exatamente
esse modelo, com a grade sob controle da serventia (dias da semana e horários que ela escolher)
e cancelamento com aviso por e-mail.

## What Changes

- **BREAKING** O envio deixa de ser pedido e vira agendamento imediato: o horário pego some da
  oferta. Morrem os statuses `requested`/`proposed`, a contraproposta da serventia e o aceite
  pelo cidadão.
- **BREAKING** Agendamento sai do guarda-chuva de protocolo: sem protocolo AGD, sem chave de
  acesso, sem consulta por protocolo. O canal com o cidadão passa a ser o e-mail (obrigatório):
  confirmação com arquivo de agenda e link de cancelamento; cancelamentos da serventia chegam
  com o motivo.
- A grade deixa de ser janela fixa no código (`startHour`/`endHour`/`capacityPerSlot`): a
  serventia configura no painel os dias da semana e os horários de início que atende. Um
  cidadão por horário — capacidade deixa de existir como conceito.
- O formulário ganha serviço (lista editável pela serventia, com "Tabelião" como serviço para o
  que não se resolve no balcão) e modo de atendimento (presencial, on-line, diligência,
  drive-thru). Agenda única: não há agendas separadas por atendente.
- O painel ganha a gestão da agenda: grade semanal, lista de serviços, agenda do dia com
  cancelamento individual e fechamento do dia inteiro, ambos com motivo enviado por e-mail a
  cada cidadão afetado.

## Capabilities

### New Capabilities

- `admin-agenda`: gestão da agenda no painel — configuração da grade semanal e da lista de
  serviços, agenda do dia, cancelar horário, fechar dia com motivo, marcar atendido.

### Modified Capabilities

- `appointment-scheduling`: a página pública passa a oferecer só horários livres da grade
  configurada; envio vira agendamento imediato com e-mail obrigatório; caem o pedido de
  horário, o protocolo, a chave e o acompanhamento por protocolo; entra o cancelamento pelo
  link do e-mail.

## Impact

- `src/core/scheduling/` — slots reescritos (horários de início vindos de config, ocupação vira
  conjunto de horários tomados); calendário de dias úteis permanece.
- `src/db/schema.ts` — tabela própria `appointments` com unicidade tenant+dia+hora; agendamento
  deixa de gravar em `service_requests` (rows antigas permanecem até o contract).
- `src/core/request/kinds.ts` — kind `appointment` some do fluxo de protocolo.
- `src/app/(public)/agendar/` — mesma tela, alimentada pela grade configurada; formulário sem
  aviso de pedido; página de cancelamento via token.
- `src/app/(public)/protocolo/` — perde o ramo de agendamento ("É a sua vez").
- `src/app/admin/(dashboard)/agenda/` — refeita: agenda do dia, sem confirmar/propor.
- `src/app/admin/(dashboard)/configuracoes/` — nova aba de agenda (grade + serviços).
- `src/lib/email/` — três e-mails novos (confirmação, cancelamento individual, fechamento de
  dia); infraestrutura Resend já existe.
- `src/core/tenant/schema.ts` — `scheduling` vira `counterHours` e perde `capacityPerSlot`; o
  campo permanece porque o horário do chat e a linha "Aberto agora" leem dele.

## Não-objetivos

- Duração por serviço (20/40/60 min): fica fora da v1; todo horário tem o mesmo tamanho. A
  lista de serviços editável deixa a porta aberta para um campo de duração depois.
- Agendas separadas (tabelião × atendentes): decisão explícita do cliente por agenda única com
  "Tabelião" como serviço.
- Remarcação pelo cidadão: cancelar pelo link e marcar de novo cobre o caso.
- Lembrete de véspera por e-mail; feriados municipais/estaduais; múltiplas vagas por horário.
