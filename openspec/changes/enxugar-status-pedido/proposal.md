## Why

O pedido de serviço tem hoje vinte andamentos possíveis, mas a maioria não carrega nenhuma regra
própria: são rótulos que o operador escolhe na mão, sem nenhuma lógica do sistema que os
distinga entre si (mesma cor, mesma fase, nenhum e-mail, nenhum prazo, nenhuma regra de negócio
ligada especificamente a eles). O menu de correção de andamento (`status-section.tsx`) virou uma
lista de vinte itens em que boa parte é sinônimo ou vocabulário de um único tipo de ato (registro
de título) espalhado para todos os outros. Uma sessão de exploração, item por item com quem opera
o painel no dia a dia, separou o que tem comportamento de verdade por trás do que é só nome.

## What Changes

- **BREAKING**: reduzir `SERVICE_REQUEST_STATUSES` de vinte para onze valores.
- Remover `filed` ("Protocolado") e `in-review` ("Em análise"): nenhum dos dois é gravado
  automaticamente por nada no sistema, e nenhuma regra depende deles — são escolha manual sem
  efeito colateral.
- Remover `pre-noted` ("Prenotado") e `in-qualification` ("Em qualificação"): vocabulário
  específico do rito de registro de título (RI), hoje oferecido a qualquer atribuição. O retorno
  automático que hoje aterrissa em `in-qualification` (quando a última exigência é cumprida) passa
  a aterrissar em `processing`.
- Fundir `registered` ("Registrado"), `annotated` ("Averbado") e `granted` ("Deferido") em
  `processing` ("Em processamento"): os quatro já compartilham o mesmo tom visual e a mesma fase,
  sem nenhuma regra que distinga um do outro.
- Fundir `with-requirement` ("Com exigência") em `awaiting-compliance`, que passa a ser o único
  andamento bloqueado por exigência, com o rótulo "Aguardando exigência".
- Remover `inactive` ("Inativo") como andamento próprio: a ação em lote de marcar protocolos como
  inativos (proposta em `bulk-protocol-inactivation`, ainda em andamento) passa a gravar
  `archived` em vez de introduzir um valor novo.
- Manter `payment-reported`, `rejected` e `cancelled` como estão: os três têm comportamento
  próprio (e-mail disparado, prazo, exigência de motivo, upload de PDF exclusivo do indeferimento,
  agora formalizado em `validateStatusReason` em `kinds.ts`) que os distingue de verdade — decisão
  explícita de não tocar, não omissão.
- Migrar os protocolos já gravados nos nove valores removidos/fundidos para o valor novo
  correspondente.

## Capabilities

### New Capabilities
(nenhuma)

### Modified Capabilities
- `admin-service-requests`: a lista de andamentos oferecida no detalhe (sugestão e correção
  manual), o mapa de cor por andamento e os exemplos de transição livre refletem os onze valores
  em vez dos dezoito hoje descritos na spec (que já estava desatualizada frente ao código, com
  vinte). A ação em lote de inativação (de `bulk-protocol-inactivation`) passa a gravar `archived`
  em vez de `inactive`.

Nenhum requisito de `service-request` (o wizard público e a consulta de protocolo) cita os
valores que saem ou se fundem pelo nome — o requisito "Situação do prazo na consulta do
protocolo" já lista só os quatro terminais que sobrevivem (concluído, indeferido, cancelado,
arquivado) — então essa capability não precisa de delta spec nesta change.

## Impact

- `src/core/request/kinds.ts`: `SERVICE_REQUEST_STATUSES`, `TERMINAL_SERVICE_REQUEST_STATUSES`,
  `SERVICE_REQUEST_PHASES`, `SUGGESTED_NEXT_STATUSES`, `STATUS_LABELS["service-request"]`,
  `statusForRequirements`.
- `src/app/admin/(dashboard)/pedidos/_components/status-tone.ts`: `STATUS_TONES` perde as
  entradas dos nove valores removidos.
- `src/app/admin/(dashboard)/pedidos/[protocolo]/_components/status-section.tsx`: `HAPPY_PATH`
  perde `in-review` (passa de cinco para quatro passos).
- `src/lib/admin-overview.ts`: `listStalledFulfilledRequirements` busca por `status = "in-review"`
  com exigência cumprida — cenário que o retorno automático já deveria impedir de existir; revisar
  se a função ainda tem uso ou se é código morto a remover junto.
- `src/app/(public)/protocolo/protocol-lookup.tsx`: condição que trata `new`/`in-review` como
  "ainda preparando" (linha ~655) perde o `in-review`.
- Migração de dado: `service_requests.status` é coluna texto livre (sem enum de banco); protocolos
  já gravados com `filed`, `in-review`, `pre-noted`, `in-qualification`, `with-requirement`,
  `registered`, `annotated`, `granted` ou `inactive` precisam de `UPDATE` remapeando para o valor
  novo antes do deploy que remove esses valores do código, ou ficam com um andamento que
  `statusLabel`/`isServiceRequestStatus` não reconhece mais.
- **Coordenação com `bulk-protocol-inactivation`** (change aberta, 15/16 tarefas): o código já
  implementa a ação em lote — `deactivateServiceRequests` em `src/lib/service-request.ts:693`
  grava `"inactive"` de verdade, não é só planejado. A delta spec dela em
  `openspec/changes/bulk-protocol-inactivation/specs/admin-service-requests/spec.md` também
  propõe esse andamento. Essa change precisa ser revisada (proposal, design, tasks, delta spec e
  o próprio `deactivateServiceRequests`) para gravar `archived` em vez de `inactive` antes de ser
  arquivada — ou arquivada primeiro com o comportamento atual e corrigida por esta change depois.

## Não-objetivos

- Não altera `payment-reported`, `rejected` nem `cancelled` — ficam como estão, com o
  comportamento que já têm hoje.
- Não resolve o andamento `ready-for-pickup` não aparecer na consulta pública do cidadão
  (`protocol-trilho.tsx` trata como "ainda em preparo"): é um problema identificado na mesma
  exploração, mas de natureza diferente (a consulta do cidadão não conhece o andamento, não é um
  excesso de valores) e fica para uma change própria.
- Não introduz status novo nem renomeia nenhum dos onze que permanecem.
- Não muda a coluna do banco de enum-livre para enum-de-banco; a migração é só de dado (UPDATE),
  não de schema.
