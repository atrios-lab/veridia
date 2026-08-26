## 1. Vocabulário do canal no núcleo

- [x] 1.1 Em `src/core/request/kinds.ts`, exportar `OMBUDSMAN_STATUSES` com os cinco andamentos
      (`new`, `in-review`, `answered`, `done`, `archived`), o tipo `OmbudsmanStatus` derivado e o
      predicado `isOmbudsmanStatus`, no mesmo formato de `SERVICE_REQUEST_STATUSES`
- [x] 1.2 Acrescentar `archived: "Arquivada"` em `STATUS_LABELS.ombudsman`
- [x] 1.3 Passar `TERMINAL_STATUSES.ombudsman` para `["answered", "done", "archived"]`
- [x] 1.4 Escrever `suggestedOmbudsmanStatuses(status)`: os próximos passos por andamento atual,
      nunca oferecendo `answered` nem o andamento atual
- [x] 1.5 Escrever `isAllowedOmbudsmanTransition(from, to)`: recusa `to === from` e recusa
      `answered`, aceita o resto dos cinco
- [x] 1.6 Em `src/core/request/kinds.test.ts`, cobrir: os cinco andamentos têm rótulo; `answered`
      não aparece em nenhuma sugestão; nenhuma sugestão repete o andamento atual; toda sugestão é
      um andamento do canal; `isOmbudsmanStatus` recusa um andamento do pedido (`pre-noted`)

## 2. Ação de tramitação

- [x] 2.1 Em `src/app/admin/(dashboard)/ouvidoria/[protocolo]/actions.ts`, criar
      `changeManifestationStatus`, seguindo o padrão das três ações vizinhas (`authorize()`,
      `FormData`, `revalidatePath("/admin", "layout")`, `ActionState`)
- [x] 2.2 Validar no servidor, nesta ordem: destino é um andamento do canal, é diferente do atual,
      não é `answered` — cada recusa com sua mensagem em português
- [x] 2.3 Chamar `updateRecordStatus` com `kind: "ombudsman"` e `action: "ombudsman.status"`
      (primeiro chamador da função; conferir se a assinatura serve sem mudança)

## 3. Bloco de tramitação no detalhe

- [x] 3.1 Criar `_components/status-section.tsx` na pasta do detalhe: pills de sugestão mais um
      `<details>` "Corrigir para outro andamento" com `<select>` plano dos quatro alcançáveis
- [x] 3.2 Montar o bloco no rodapé do card em `page.tsx`, depois da resposta ou da anotação, para
      manifestação identificada e anônima igualmente
- [x] 3.3 Acrescentar o estilo de `archived` em `_components/status-badge.tsx` (terminal, como
      `done`, e visualmente distinto dele)
- [x] 3.4 Acrescentar `"ombudsman.status": "alterou o andamento"` em `HISTORY_LABELS` do detalhe e
      no mapa gêmeo de `src/lib/admin-overview.ts`

## 4. Consulta do cidadão

- [x] 4.1 Em `OmbudsmanCard` (`src/app/(public)/protocolo/protocol-lookup.tsx`), fazer o último
      passo da linha do tempo seguir o andamento, não a presença de resposta: encerrada sem
      resposta aparece encerrada
- [x] 4.2 Conferir que a anotação interna continua fora da consulta: `listRecordHistory` não é
      chamada pelo público e `actions.ts` da consulta não lê `details.internalNote`

## 5. Verificação

- [x] 5.1 Em `e2e/admin-ombudsman.spec.ts`, cobrir o caso do relato: manifestação anônima em
      "Recebida" é concluída pelo bloco, o badge muda e o histórico registra
- [x] 5.2 Cobrir arquivar e a correção de volta para "Em apuração"
- [x] 5.3 Cobrir que "Respondida" não aparece entre os andamentos oferecidos
- [x] 5.4 Rodar `pnpm test` e `pnpm lint`; rodar o e2e da ouvidoria com `DATABASE_URL`,
      `ADMIN_SEED_EMAIL` e `ADMIN_SEED_PASSWORD`
