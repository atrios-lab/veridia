## Why

O painel administrativo hoje não tem nenhuma tela de operação: `/admin` é um placeholder que só
linka para Configurações, e o item "Pedidos de serviço" da sidebar nem existe (a spec de
`admin-shell` documenta isso como estado esperado). Todo pedido que o cidadão registra pelo
`/solicitar` fica preso no banco sem ninguém conseguir vê-lo, mudar o andamento, cobrar uma
exigência, entregar o documento final ou informar o valor — a serventia processa por fora do
sistema. Esta é a primeira tela de operação do painel: fila de pedidos, detalhe do pedido e
lançamento manual do que chega no balcão.

## What Changes

- Nova rota `/admin/pedidos`: fila filtrável por andamento e atribuição, com busca por protocolo
  ou nome, contador de pedidos em aberto no cabeçalho da linha e o link "Lançar pedido".
- Nova rota `/admin/pedidos/[protocolo]`: detalhe do pedido — mudar o andamento, registrar
  exigência, ver o histórico de exigências e sua resolução, anexar o documento final de entrega,
  informar o valor do pedido, emitir nova chave de acesso (invalida a anterior na hora) e excluir
  o protocolo (reservado a abertura por engano — um pedido real que não segue usa o andamento
  "Cancelado", nunca a exclusão).
- Nova rota `/admin/pedidos/novo`: lançamento manual de um pedido recebido presencialmente, mesmo
  vocabulário atribuição → ato do wizard público, mas em formulário único preenchido pela
  serventia; gera protocolo e chave como no site público.
- Vocabulário de andamento (status) do pedido de serviço passa de um único valor (`new`) para oito:
  Novo, Em análise, Aguardando pagamento, Pago, Concluído, Indeferido, Cancelado, Arquivado.
- Novo conceito de **exigência**: o operador registra um texto pendente no pedido; o cidadão a
  cumpre pela consulta de protocolo existente (`/protocolo`), sem e-mail nem telefone. É um bloco
  dentro do pedido, sem tela própria.
- Novo campo de **valor do pedido** (`amountCents`), nulo até o operador informar — antes disso o
  cidadão não vê nem paga nada.
- Item "Pedidos de serviço" passa a existir na sidebar do painel, com o contador de pedidos em
  aberto, atrás da permissão nova `requests.manage` (concedida a `admin` e `staff` — é trabalho de
  operação do dia a dia, não configuração sensível).
- Sidebar e cabeçalho do painel ganham o indicador "Disponível para o chat" mostrado no design;
  fica como aceno visual sem estado nenhum por trás (Atendimento online é entrega futura).

## Non-Goals

- **Não** toca em Requerimentos LGPD, Ouvidoria ou Agenda de atendimentos — o design desta entrega
  cobre só `kind = "service-request"`. Os contadores desses outros itens da sidebar continuam sem
  existir (fora de escopo, entregas futuras).
- **Não** gera QR Code, copia-e-cola nem qualquer payload Pix para o cidadão pagar. `amountCents`
  passa a existir e o operador passa a poder informá-lo, mas exibir isso ao cidadão (com ou sem
  Pix) fica para a mudança que expuser o valor devido na consulta de protocolo.
- **Não** cria um usuário nem papel novo. A persona "Helena Duarte — Registradora" do design é
  ilustrativa; os papéis continuam sendo só `admin`/`staff`, com os rótulos já existentes
  ("Registrador"/"Atendimento").
- **Não** implementa o indicador "Disponível para o chat" como estado real nem a tela de
  Atendimento online — é só o elemento visual do design, sem lógica.
- **Não** muda como anexos do cidadão são armazenados nem a política de retenção; reaproveita
  `src/lib/uploads.ts` como já existe, inclusive para o documento final de entrega (`kind:
  "office"`, campo que já existe na tabela de anexos).
- **Não** adiciona um segundo nível de permissão dentro da tela (ex.: exclusão só para `admin`). O
  design não distingue papéis dentro do pedido — toda a tela fica atrás de uma permissão só.

## Capabilities

### New Capabilities

- `admin-service-requests`: fila de pedidos, detalhe do pedido (andamento, exigência, entrega,
  valor, chave de acesso, histórico, exclusão restrita) e lançamento manual — as três telas do
  painel para operar pedidos de serviço.

### Modified Capabilities

- `service-request`: vocabulário de andamento expandido para oito estados; conceito de exigência
  (registro pelo operador, cumprimento pelo cidadão via `/protocolo`); campo de valor do pedido;
  reemissão de chave de acesso invalida a anterior.
- `admin-shell`: o item "Pedidos de serviço" passa a existir na sidebar, com contador de pedidos
  em aberto, atrás de `requests.manage`. O cenário "rota inexistente não vira item de menu"
  continua valendo para as demais rotas ainda não construídas — só este item deixa de ser exemplo
  dele.

## Impact

- `src/db/schema.ts`: `amountCents integer` em `service_requests`; nova tabela
  `service_request_requirements` (id, tenantSlug, requestId FK cascade, text, status
  pending/fulfilled, createdAt, fulfilledAt, resolutionAttachmentId FK opcional para
  `service_request_attachments`); migração Drizzle nova (expand-only, sem coluna removida).
- `src/core/request/kinds.ts`: `STATUS_LABELS` para `service-request` ganha os oito valores;
  `statusLabel()` deixa de cair no fallback genérico para este kind.
- `src/core/request/requirement.ts` (novo): tipos e validação Zod da exigência, puro, sem I/O.
- `src/core/auth/roles.ts`: permissão `requests.manage`, concedida a `admin` e `staff`.
- `src/lib/service-request.ts`: novas funções de leitura/escrita administrativa —
  `listServiceRequests` (filtro por andamento/atribuição/busca), `updateStatus`,
  `registerRequirement`, `fulfillRequirement`, `setAmount`, `reissueAccessKey`,
  `deleteRequest` (restrita), `openRequestCount` (para o contador da sidebar). Nenhuma função
  citizen-facing existente muda de assinatura.
- `src/app/admin/(dashboard)/pedidos/`: rotas novas (`page.tsx` fila, `[protocolo]/page.tsx`
  detalhe, `novo/page.tsx` lançamento manual) + `actions.ts` (server actions, cada uma checando
  `requests.manage` e chamando `recordAudit()`).
- `src/app/admin/_components/nav.ts`: item "Pedidos de serviço" com contador dinâmico.
- `src/app/(public)/protocolo/protocol-lookup.tsx`: bloco de exigência pendente (texto + upload de
  resposta) quando o pedido consultado tiver uma exigência aberta — reaproveita o padrão de anexo
  já usado ali para o requerimento assinado.
- Testes: `src/db/service-request.test.ts` (requirement + amountCents + reissue), teste novo para
  `src/core/request/requirement.ts`, `e2e/admin-service-requests.spec.ts` novo (fila, detalhe,
  lançamento manual), extensão em `e2e/service-request.spec.ts` (exigência pela consulta).
