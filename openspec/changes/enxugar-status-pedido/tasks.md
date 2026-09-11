## 1. Migração de dado

- [x] 1.1 Escrever migration Drizzle com `UPDATE service_requests SET status = ... WHERE status IN (...)` remapeando os nove valores antigos para os novos, conforme a tabela do design.md (`filed`→`new`, `in-review`/`pre-noted`/`in-qualification`/`registered`/`annotated`/`granted`→`processing`, `with-requirement`→`awaiting-compliance`, `inactive`→`archived`). Feito em `drizzle/0021_calm_gatekeeper.sql`, com `WHERE kind = 'service-request'` em cada UPDATE — sem esse filtro, `in-review` também bateria em registros de `ombudsman`, que usa a mesma string com outro sentido.
- [ ] 1.2 Confirmar em ambiente de homologação (ou com uma query de contagem por status em produção) que nenhum protocolo permanece nos nove valores antigos depois da migration. **Não executável a partir daqui** — precisa rodar contra um banco real depois do deploy; deixo pendente para quem aplicar o deploy confirmar.

## 2. Núcleo (`src/core/request/kinds.ts`)

- [x] 2.1 Reduzir `SERVICE_REQUEST_STATUSES` para os onze valores.
- [x] 2.2 Atualizar `TERMINAL_SERVICE_REQUEST_STATUSES` (remover `inactive`).
- [x] 2.3 Recalcular `SERVICE_REQUEST_PHASES` para os onze valores (ver mapa no design.md), mantendo os seis nomes de fase.
- [x] 2.4 Reescrever `SUGGESTED_NEXT_STATUSES` com a tabela do design.md.
- [x] 2.5 Simplificar `statusForRequirements` para um único status bloqueante (`awaiting-compliance`) com retorno automático para `processing`.
- [x] 2.6 Atualizar `STATUS_LABELS["service-request"]` removendo as entradas dos nove valores que saem.

## 3. Painel admin

- [x] 3.1 `src/app/admin/(dashboard)/pedidos/_components/status-tone.ts`: remover as entradas de `STATUS_TONES` dos valores removidos; confirmar que o `Record` sem fallback ainda compila (TypeScript aponta qualquer valor esquecido).
- [x] 3.2 `src/app/admin/(dashboard)/pedidos/[protocolo]/_components/status-section.tsx`: remover `in-review` do `HAPPY_PATH` (fica com quatro passos).
- [x] 3.3 `src/lib/admin-overview.ts`: removida `listStalledFulfilledRequirements`, `StalledRequest` e o trecho que a invocava em `listDeskItems`; `hasFulfilledPendingRequirement` fica `false` sempre (comentado). Decisão tomada e revista em conversa: cogitou-se generalizar o filtro em vez de apagar (a função alimentava o card real "exigência cumprida, aguardando retomada" da mesa), mas o usuário confirmou manter a remoção original.
- [x] 3.4 Rodar os testes existentes de `kinds.ts`, `status-tone.ts` e da tela de detalhe do pedido; ajustar qualquer teste que cite um dos nove valores removidos. Também ajustados (achados via `pnpm typecheck`/grep, fora do escopo original da task): `queue-order.test.ts`, `deadline.test.ts` e `src/db/service-request.test.ts` (que também ganhou o ajuste de `inactive`→`archived` da task 5.3). `pnpm test`: 546/546.

## 4. Site público

- [x] 4.1 `src/app/(public)/protocolo/protocol-lookup.tsx`: remover `in-review` da condição que trata `new`/`in-review` como "ainda preparando, sem valor definido" (linha ~655), deixando só `new`.
- [x] 4.2 Rodar os testes de `protocol-lookup.tsx`/consulta pública e confirmar que nenhum outro trecho do site cita um dos nove valores removidos. Achados via grep e ajustados nos e2e: `admin-requirement-conversation.spec.ts` (o teste do rito registral virou sobre "Em processamento" genérico), `admin-overview.spec.ts` (fixture `REQ_STALLED` usava `in-review`; ver nota da task 3.3) e `admin-service-requests.spec.ts` (botão/selo "Em análise" → "Em processamento").

## 5. Coordenação com `bulk-protocol-inactivation`

- [x] 5.1 Revisar `openspec/changes/bulk-protocol-inactivation/proposal.md`, `design.md` e `tasks.md`: trocar as referências ao andamento `inactive` por "a ação em lote grava `archived`". `tasks.md` ganhou uma nota explicando a revisão em vez de reescrever o histórico do que já foi implementado.
- [x] 5.2 Revisar `openspec/changes/bulk-protocol-inactivation/specs/admin-service-requests/spec.md`: reescrito. O requisito "Contador de pedidos em aberto" nem precisou de MODIFIED — a spec principal já lista só os quatro terminais (Concluído, Indeferido, Cancelado, Arquivado), sem `inactive`, então gravar `archived` não muda esse requisito nenhum.
- [x] 5.3 `src/lib/service-request.ts`: `deactivateServiceRequests` já grava `"inactive"` (linha 693) — trocado para `"archived"`. Achado durante a implementação: o texto da ação em lote na fila (`queue-rows.tsx`: botão, confirmação e teste em `src/db/service-request.test.ts`) dizia "Marcar como inativo" — atualizado para "Arquivar", senão o botão diria uma coisa e o selo do protocolo mostraria outra.

## 6. Validação final

- [x] 6.1 `openspec validate enxugar-status-pedido --strict`. Ok — e `bulk-protocol-inactivation --strict` também, depois da revisão da task 5.
- [x] 6.2 Buscar no código inteiro (`grep -rn`) pelos nove valores removidos fora de comentários históricos/changelog, confirmando que não sobrou nenhuma referência viva. Único achado fora do já corrigido: `in-review` continua vivo, mas só como valor de `OmbudsmanStatus` ("Em apuração") — tipo diferente, string coincidente, fora do escopo desta change (ver Non-Goals do design.md).
- [x] 6.3 Testado manualmente no painel (servidor dev já rodando, banco real): filtro da fila lista os onze na ordem certa; barra de progresso do detalhe tem 4 passos (Novo/Aguardando pagamento/Pago/Concluído); REQ.2026.000011 movido de "Novo" para "Em processamento" via sugestão, com selo, tom e sugestões seguintes ("Disponível para retirada"/"Concluído") corretos; select "Corrigir para outro andamento" lista os onze agrupados por fase.
