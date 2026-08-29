## 1. Núcleo: contagem e urgência generalizadas

- [x] 1.1 Criar `src/core/request/deadline.ts` com `deadlineDate(startedOn, days)`, `dayOfDeadline(startedOn, today)` e o resolvedor do prazo efetivo do pedido (gravado no `details` ou calculado de `createdAt` + default do tenant); fazer `dataRightsDeadline`/`dataRightsDayOfDeadline` em `channels.ts` delegarem para elas com 15 fixo
- [x] 1.2 Generalizar `src/core/overview/urgency.ts`: extrair `deadlineUrgency(open, startedOn, days, today)` com os kinds atuais (`due-soon` ≤ 3 dias, `overdue` com `daysLate`); `dataRightsUrgency` vira wrapper; urgência do pedido usa `isOpenServiceRequestStatus`
- [x] 1.3 Adicionar bloco opcional `deadline: { startedOn, days (1–365) }` ao `serviceRequestDetailsSchema` em `src/core/request/kinds.ts`
- [x] 1.4 Testes `node --test` do núcleo: contagem, resolvedor (com e sem prazo gravado), urgência aberta/terminal, LGPD inalterado

## 2. Default do tenant

- [x] 2.1 Adicionar o campo de prazo padrão ao `TenantSchema` com `.default(30)` e comentário citando a Lei 6.015 (art. 188)
- [x] 2.2 Criar `OfficeDeadlineSchema` em `src/core/tenant/overrides.ts` no mesmo pick-discipline dos existentes, com persistência via `tenant_content` e leitura no resolve do tenant
- [x] 2.3 Testes do override (parse, valores inválidos recusados, partial na leitura)

## 3. Painel: Configurações

- [x] 3.1 Adicionar o campo "Prazo padrão de análise (dias corridos)" à tela de Configurações, na aba dos dados operacionais, com server action validando 1–365 e gravando com auditoria
- [x] 3.2 Nota na tela deixando claro que o prazo LGPD é fixo em 15 dias por lei e não é afetado

## 4. Painel: troca de andamento e urgência

- [x] 4.1 Estender a server action de troca de andamento em `pedidos/[protocolo]` para aceitar o bloco opcional de prazo (zerar / ajustar dias), validar 1–365, gravar `details.deadline` na mesma escrita e incluir a alteração na auditoria
- [x] 4.2 UI do controle de prazo no formulário de troca de andamento: prazo vigente visível ("até DD/MM · dia X de N"), colapsado por padrão, ações manter/zerar/ajustar; disponível também em pedidos de balcão
- [x] 4.3 Badge de urgência na fila de pedidos e no cabeçalho do detalhe, reusando o padrão visual do `deadline-badge` do LGPD; sem badge em andamento terminal ou fora da janela

## 5. Site público

- [x] 5.1 Consulta do protocolo: bloco de prazo do pedido em `protocol-lookup.tsx` ("dia X de N · previsão até DD/MM"; vencido = "em revisão pelo cartório", sem contagem de atraso; nada em andamento terminal), com o prazo efetivo resolvido no server em `protocolo/actions.ts`
- [x] 5.2 Confirmação da emissão em `/solicitar` (e recibo do balcão, se exibir data): linha "prazo estimado de análise: até DD/MM" calculada do default do tenant

## 6. Prazo legal por ato (revisão após conferência jurídica)

- [x] 6.1 Trocar a contagem para dias úteis reusando `isBusinessDay`/`nationalHolidays` da agenda, com o dia do protocolo excluído (CPC); manter o canal LGPD em dias corridos
- [x] 6.2 Adicionar `legalDeadlineDays` e `legalDeadlineNote` ao catálogo de atos e preencher os oito prazos da tabela conferida com a serventia
- [x] 6.3 `effectiveDeadline` passa a resolver na ordem: prazo gravado → prazo legal do ato → padrão do cartório
- [x] 6.4 Recontextualizar o campo de Configurações como padrão dos atos sem prazo legal, em dias úteis
- [x] 6.5 Exibir `DEADLINE_CAVEAT` (ordem de chegada) na emissão, na consulta e no recibo do balcão
- [x] 6.6 Testes de dias úteis, feriado nacional, feriado derivado da Páscoa e ordem de precedência

## 7. Verificação

- [x] 7.1 Rodar suíte `node --test` completa e Biome
- [x] 7.2 Verificar no navegador pelo host do cartório (majorsales.localhost): certidão (5 dias úteis) prevê 04/09 e registro na matrícula (10 dias úteis) prevê 14/09, pulando o feriado de 07/09 ✅; consulta mostra a contagem e a ressalva da ordem de chegada ✅. O controle de prazo na troca de andamento e o campo em Configurações não foram vistos no navegador (o painel exige login); cobertos por tsc + 433 testes. Os pedidos de teste usados (REQ.2026.000001 e 000002) foram apagados do banco depois, com auditoria.
