## 1. Núcleo

- [x] 1.1 `CustomHoliday`/`OfficeHolidays` e `holidayName`/`isHoliday`/`isBusinessDay`/`nextBusinessDays` com feriados próprios
- [x] 1.2 `upcomingClosedDays` para o painel
- [x] 1.3 Repassar feriados em `deadline`, `urgency`, `notice-schedule`, `notice-types`, `expiry`, `slots` (`OfficeAgenda`) e `hours`

## 2. Configuração da serventia

- [x] 2.1 `customHolidays` no `TenantSchema` (nome, data real, anual), até 60
- [x] 2.2 `OfficeHolidaysSchema`, override `holidays` e chave `office-holidays` lida em `getTenant`

## 3. Pontos de chamada

- [x] 3.1 Site público: home, editais, agendar (página e action), solicitar, protocolo
- [x] 3.2 Painel: fila e detalhe de pedidos (inclui `DeadlineBadge` e `QueueRows`), novo pedido, agenda (página, action, prévia da configuração), publicações (lista, detalhe, formulário e prévia)
- [x] 3.3 `lib/service-request.ts`: retomada do prazo após pausa

## 4. Painel

- [x] 4.1 `saveOfficeHolidays`: permissão, schema, gravação inteira, auditoria, erros por linha
- [x] 4.2 Seção "Feriados e dias sem expediente": dias da lei recolhidos, linhas editáveis, atalhos de nome

## 5. Verificação

- [x] 5.1 Testes: anual, data única, agenda, prazo, status, override, schema, lista do painel
- [x] 5.2 Bateria do CI
- [x] 5.3 Conferência no navegador: erro de nome vazio, gravação, home refletindo o feriado
