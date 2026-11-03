## 1. Módulo do fuso

- [x] 1.1 Criar `src/core/time/office-time.ts` com `OFFICE_TIME_ZONE` igual a `America/Fortaleza`, `formatOfficeDate`, `formatOfficeDayMonth`, `formatOfficeDayMonthTime`, `formatOfficeDateTime`, `formatOfficeTime`, `formatOfficeMonthYear` e `officeYear`, recebendo `Date`
- [x] 1.2 Em `src/lib/office-config.ts`, reexportar `OFFICE_TIME_ZONE` do novo módulo, sem mudar quem já importa de lá
- [x] 1.3 Criar `src/core/time/office-time.test.ts`: cada formatador dá o mesmo resultado com `process.env.TZ` em `UTC`, `America/Sao_Paulo` e `Asia/Tokyo`, incluindo 22:30 de 03/11 e a noite de 31/12
- [x] 1.4 Trocar os valores próprios de `src/core/chat/hours.ts`, `contato/page.tsx` e `publicacoes/_components/publication-form.tsx` por `OFFICE_TIME_ZONE`, e rodar os testes de chat

## 2. Painel

- [x] 2.1 Em `pedidos/[protocolo]/page.tsx`, trocar `formatDayMonthTime` e `formatDayMonthYear` pelos formatadores do módulo
- [x] 2.2 Em `requirements-section.tsx`, trocar `formatDayMonthTime` e `formatDayMonth`, mantendo o separador " · "
- [x] 2.3 Em `lgpd/[protocolo]/page.tsx` e `ouvidoria/[protocolo]/page.tsx`, trocar `formatDayMonthTime`
- [x] 2.4 Em `transparencia/_components/document-list.tsx`, trocar `monthYear`
- [x] 2.5 Em `src/lib/admin-overview.ts:123`, calcular `requestedOn` com `toIsoDate(row.createdAt, OFFICE_TIME_ZONE)` e cobrir em teste a solicitação feita depois das 21h

## 3. PDFs

- [x] 3.1 Em `src/core/request/requerimento.ts`, trocar `formatDate` e cobrir em `requerimento.test.ts` o pedido feito às 22:30, com `TZ=UTC`
- [x] 3.2 Em `src/core/request/declaracao.ts`, trocar o fuso próprio de `formatAcceptedAt` por `OFFICE_TIME_ZONE`, mantendo o formato "dd/mm/aaaa às hh:mm", e cobrir em teste

## 4. Site público

- [x] 4.1 Em `acompanhar/protocol-trilho.tsx`, mostrar `deadlineTerm.date` com `formatDate` de `calendar.ts`, sem criar `Date`
- [x] 4.2 Em `acompanhar/protocol-trilho.tsx`, trocar os formatadores de instante e o `getDate()` de `formatDay` pelo módulo, inclusive a chave de agrupamento do histórico
- [x] 4.3 Em `acompanhar/protocol-trilho.tsx`, recalcular "disponível até" com `toIsoDate`, `addDays` e `formatDate` de `calendar.ts`
- [x] 4.4 Em `protocolo/protocol-lookup.tsx`, mostrar `deadline.date` e `result.deadline` com `formatDate` de `calendar.ts`, removendo o `T00:00:00`
- [x] 4.5 Em `protocolo/protocol-lookup.tsx`, trocar os formatadores de instante pelo módulo

## 5. Ano do protocolo

- [x] 5.1 Em `src/lib/service-request.ts:138` e `src/lib/appointments.ts:253`, trocar `new Date().getFullYear()` por `officeYear(new Date())`
- [x] 5.2 Fazer a mesma troca em `solicitar/actions.ts`, `lgpd/actions.ts` e `ouvidoria/actions.ts`
- [x] 5.3 Cobrir em teste com PGlite e relógio simulado, com `TZ=UTC`, o protocolo criado às 22:00 de 31/12 no horário da serventia e o criado às 00:10 de 01/01

## 6. Proteção contra regressão

- [x] 6.1 Criar `src/lib/no-bare-date-format.test.ts`, que varre `src` e falha se encontrar `Intl.DateTimeFormat` com data ou hora sem `timeZone`, e `.getFullYear()` ou `.toISOString().slice(0, 10)` sobre instante fora dos pontos conhecidos
- [x] 6.2 Rodar `src/core/time/office-time.test.ts` e os testes tocados pelas seções 2 a 5

## 7. Entrega

- [ ] 7.1 Rodar o dev server com `TZ=UTC` e conferir pelo host do cartório o detalhe do pedido, o PDF do requerimento e `/acompanhar`, comparando com o horário gravado
- [x] 7.2 Abrir o PR a partir de uma branch própria, descrevendo que pedidos antigos feitos depois das 21h passam a imprimir a data corrigida
