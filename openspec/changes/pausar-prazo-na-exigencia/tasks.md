## 1. Núcleo do prazo

- [ ] 1.1 `deadlineSchema` em `src/core/request/deadline.ts` ganha `pausedOn` opcional (data ISO); `readDeadline` passa a devolvê-lo
- [ ] 1.2 `pauseReasons({ status, amountCents, pendingRequirements })` pura, com teste: exigência pendente, pagamento com valor, pagamento sem valor, andamento sem exigência
- [ ] 1.3 `resumeDeadline(deadline, today, hasLegalTerm)` pura, com teste: zera com prazo legal; desloca `startedOn` pelos dias úteis da pausa sem prazo legal; pausa atravessando fim de semana
- [ ] 1.4 `deadlineUrgency` em `src/core/overview/urgency.ts` recebe o prazo inteiro e devolve `paused` com `waitingDays` e contagem congelada em `pausedOn`; `closed` continua vindo antes; ajustar `urgency.test.ts` e os chamadores

## 2. Reconciliação e auditoria

- [ ] 2.1 `reconcileDeadlinePause(tenant, requestId, actorId)` em `src/lib/service-request.ts`: lê pedido e exigências pendentes, grava `pausedOn` (materializando o prazo efetivo) ou retoma, audita `service-request.deadline.pause` / `service-request.deadline.resume`
- [ ] 2.2 Chamar a reconciliação nas actions de registrar, cumprir e excluir exigência
- [ ] 2.3 Chamar a reconciliação nas actions de lançar/remover valor e de trocar andamento (inclusive no caminho "Salvar prazo", que deve manter a pausa)
- [ ] 2.4 Histórico do detalhe rotula as duas ações novas ("suspendeu o prazo", "retomou o prazo")

## 3. Painel

- [ ] 3.1 `DeadlineBadge` em `pedidos/_components/deadline-badge.tsx` ganha o estado suspenso: selo neutro "Aguardando o cidadão há N dias úteis" / "desde hoje"
- [ ] 3.2 Comparador em `pedidos/_components/queue-order.ts`: suspensos depois de vencidos e vence em breve, mais tempo de espera no topo; teste do comparador
- [ ] 3.3 Detalhe (`pedidos/[protocolo]/page.tsx` e `status-section.tsx`): cabeçalho com o selo e resumo "Prazo: suspenso desde DD/MM · dia X de N"; zerar e ajustar mantêm `pausedOn`

## 4. Consulta do cidadão

- [ ] 4.1 `protocolo/actions.ts` devolve `deadline.paused` com os motivos; `DeadlineNote` em `protocol-lookup.tsx` mostra "Prazo suspenso: aguardando…" sem data prevista, e volta ao texto atual quando retomado

## 5. Pedidos já parados

- [ ] 5.1 Script único `scripts/backfill-deadline-pause.ts`: pedidos abertos com exigência pendente recebem `pausedOn` da exigência mais antiga; "Aguardando pagamento" com valor recebe `updatedAt`; audita sem ator
- [ ] 5.2 Rodar no Homolog e conferir a fila e dois detalhes; rodar em produção e conferir os "Com pendência"

## 6. Verificação

- [ ] 6.1 e2e em `e2e/admin-service-requests.spec.ts`: registrar exigência troca o selo pelo de espera; cumprir a exigência retoma e, para ato com prazo legal, recomeça a contagem
- [ ] 6.2 Conferir com a serventia a redação do art. 188 e do Código de Normas da Corregedoria sobre o prazo da reapresentação; registrar o resultado no design
- [ ] 6.3 Sincronizar ou arquivar `adicionar-prazo-do-protocolo` antes de arquivar esta change, para as specs principais receberem os requisitos em ordem
