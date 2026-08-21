## 1. Núcleo e banco

- [x] 1.1 `core/scheduling/appointment.ts`: status `no_show` (rótulo "Faltou"), tipo de origem
  `site`/`desk`, `SLOT_HOLDING_STATUSES` inclui `no_show`
- [x] 1.2 `core/scheduling/agenda.ts`: `notaryOnly` no serviço (default false; config antiga
  parseia)
- [x] 1.3 `db/schema.ts`: `origin` (default 'site'), `protocol_year`, `protocol_sequence`,
  `protocol_number` + índices únicos; migração gerada via drizzle-kit e conferida por
  `check:destructive`
- [x] 1.4 Testes do núcleo: rótulo de `no_show`; parse de config sem `notaryOnly`

## 2. Escritas

- [x] 2.1 `lib/appointments.ts`: protocolo AGD no `bookAppointment` (laço com retry,
  desambiguação por constraint), `origin` no insert e na auditoria
- [x] 2.2 `lib/appointments.ts`: `markNoShow`, `liveCountsByDay`, `futureLiveByWeekdayTime`,
  `findAppointmentByProtocol`
- [x] 2.3 `agenda/actions.ts`: ação "Faltou", ação de reserva de balcão (validada com
  `isOfferedDay`/`isSlotFree` + corrida pelo banco; e-mail só com e-mail informado),
  `saveAgenda` recebendo o config em JSON
- [x] 2.4 `core/overview/desk.ts` trata `no_show` como resolvido; rótulos de auditoria novos em
  `lib/admin-overview.ts`; badge "Faltou" e "Reservado no balcão"

## 3. Agenda do dia

- [x] 3.1 Régua de dias úteis (`dia` + `de`, setas ±7, ocupação, hoje, Fechado) e nota de fim
  de semana
- [x] 3.2 Lista do dia com linhas de agendamento (protocolo, contato, ações Marcar
  atendido/Faltou/Cancelar) e linhas livres com "Reservar para um cidadão" (formulário inline)
- [x] 3.3 Barra lateral: cartão de configuração, cartão "Fechar este dia" (rotulado com a
  data), cartão "Dias fechados à frente" com Reabrir e a nota; data fechada selecionada mostra
  motivo + reabrir

## 4. Configuração

- [x] 4.1 `AdminPageHeader` com prop `back`; página usa "‹ Agenda"
- [x] 4.2 Grade por chips: adicionar via `<input type="time">`, remover com confirmação quando
  há agendamento futuro, "Copiar de segunda", "N cidadãos/dia"/"Não aparece no site"
- [x] 4.3 Serviços com alternador "Só com o tabelião" e remoção; adicionar por campo + botão
- [x] 4.4 Modos como cartões marcáveis (conhecidos + já configurados)
- [x] 4.5 Prévia "Como o cidadão vê" do estado não salvo, ocupados riscados
- [x] 4.6 Barra fixa de alterações não salvas (resumo, Descartar, Salvar) com toast de sucesso;
  cartão "Fechar um dia específico" apontando para a agenda

## 5. Público

- [x] 5.1 Select de serviços do `/agendar` anuncia "só com o tabelião"
- [x] 5.2 `/protocolo` responde protocolos AGD da tabela de agendamentos

## 6. Verificação

- [x] 6.1 e2e: rótulos atualizados, teste de "Faltou", teste do caminho para a configuração
  adaptado aos chips
- [x] 6.2 `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm check:tokens`, `pnpm check:dashes`,
  `pnpm check:destructive`
