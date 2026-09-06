## 1. Núcleo (`src/core/request/kinds.ts`)

- [x] 1.1 Adicionar `"inactive"` a `SERVICE_REQUEST_STATUSES` e a `TERMINAL_SERVICE_REQUEST_STATUSES`
- [x] 1.2 Adicionar `inactive: "Inativo"` a `STATUS_LABELS["service-request"]`
- [x] 1.3 Adicionar `inactive` a `SERVICE_REQUEST_PHASES` (fase `closed`) e a `SUGGESTED_NEXT_STATUSES` (entrada `inactive: []`, sem sugestão de saída forçada)
- [x] 1.4 Teste garantindo que todo `Record<ServiceRequestStatus, ...>` do arquivo tem entrada para os dezenove status (mesmo padrão do teste existente de `phaseOfStatus`) — já coberto pelos testes existentes (`every service request status has a Portuguese label`, `every andamento belongs to exactly one phase`, `every suggestion is itself a valid andamento`) e pelo compilador em `STATUS_TONES`/`SUGGESTED_NEXT_STATUSES`, que são `Record<ServiceRequestStatus, ...>` exaustivos

## 2. Lib / ação em lote (`src/lib/service-request.ts`)

- [x] 2.1 Implementar `deactivateServiceRequests(tenantSlug, ids, actorId)`: valida que todo id pertence ao tenant antes de escrever, depois reaproveita `updateRequestStatus` por protocolo (histórico próprio por evento, como já fazia a troca individual de andamento)
- [x] 2.2 Server Action `deactivateServiceRequestsAction` em `pedidos/actions.ts`: checa permissão `requests.manage`, chama a função acima, revalida a rota da fila
- [x] 2.3 Teste de integração: lote com um protocolo fora do tenant falha a checagem de posse antes de qualquer escrita (`src/db/service-request.test.ts`)

## 3. UI da fila (`src/app/admin/(dashboard)/pedidos/`)

- [x] 3.1 Tom visual para `inactive` em `_components/status-tone.ts`
- [x] 3.2 Checkbox por linha e checkbox "selecionar todos" no cabeçalho da tabela (estado local no client component da fila, `_components/queue-rows.tsx`)
- [x] 3.3 Barra/botão de ação "Marcar como inativo", visível só com seleção não vazia, mostrando a contagem selecionada
- [x] 3.4 Diálogo de confirmação (reusa `ConfirmAction` já usado em `DangerSection`) com texto explicando que a ação não apaga dados e é reversível pelo detalhe
- [x] 3.5 Ao confirmar, chama `deactivateServiceRequestsAction`; a seleção some junto com a barra de ação quando a lista recarrega (revalidação da rota)
- [x] 3.6 Incluir "Inativo" nas opções do filtro de andamento já existente na fila — automático: o `<select>` já itera `SERVICE_REQUEST_STATUSES`

## 4. Specs e validação

- [x] 4.1 `openspec validate bulk-protocol-inactivation --strict`
- [x] 4.2 Rodar `node --test` dos arquivos tocados (`kinds.test.ts`, `queue-order.test.ts`, `status-tone.test.ts`, `src/db/service-request.test.ts`) e `tsc --noEmit`
- [ ] 4.3 Playwright: selecionar dois protocolos, marcar como inativo, confirmar e verificar que ambos aparecem com o andamento "Inativo" na fila — não rodado (precisa de banco de dados; ver nota abaixo)
