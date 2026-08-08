## Context

`/admin` hoje é um placeholder e `service_requests` só conhece o status `new` (ver
`src/core/request/kinds.ts`). O design importado (`Redesign 06 — Admin Pedidos de Serviço`)
especifica três telas ligadas: fila (6a), detalhe (6b) e lançamento manual (6c), todas dentro do
mesmo fluxo. `src/lib/service-request.ts` hoje só tem operações citizen-facing
(`createRecord`, `findByProtocolWithKey`, `attachToRequest`, `updateDetails`); nada de leitura em
lote, mudança de andamento ou exclusão existe. `src/app/(public)/protocolo/protocol-lookup.tsx` já
é a tela onde o cidadão consulta o próprio pedido pela chave — é nela que a exigência aparece,
porque o design intencionalmente não desenha tela própria pra isso.

## Goals / Non-Goals

**Goals:**
- As três telas do design funcionando com dado real, sem mock.
- Vocabulário de andamento, exigência e valor vivendo no núcleo (`src/core/request`), sem regra de
  negócio dentro de Server Actions ou componentes.
- Fechar o laço exigência: o que o operador registra no painel, o cidadão cumpre em `/protocolo`
  sem precisar de e-mail nem telefone — como o design promete.

**Non-Goals:**
- Máquina de estados rígida para os 8 andamentos (ver Decisions — transições são curadas na UI,
  não impostas no banco).
- Exibir o valor ao cidadão ou gerar cobrança Pix — só o operador informa; a exibição fica pra
  outra mudança (repete o Non-Goal já registrado em `add-billing-and-dpo-settings`).
- Paginação da fila — volume por serventia é baixo o bastante pra listar tudo com filtro; adiciona
  quando o volume pedir.

## Decisions

### Exigência como tabela própria, não campo dentro de `details`

`details jsonb` já existe e serve pra campo solto por kind, mas exigência tem ciclo de vida
próprio (pendente → cumprida, com anexo de resolução e timestamps) e precisa aparecer em lista
(histórico de exigências do pedido) e ser consultada pelo lado do cidadão sem reprocessar o JSON
inteiro. Segue o mesmo padrão de `service_request_attachments`: tabela própria,
`requestId` FK `ON DELETE CASCADE`, index em `requestId`.

Alternativa considerada: guardar como array dentro de `details`. Rejeitada — exigência é
consultada e resolvida a partir de dois lados (painel e `/protocolo`) de forma concorrente; um
campo JSON versionado como blob único é mais fácil de pisar numa escrita concorrente do que uma
linha de tabela com seu próprio `UPDATE ... WHERE id = ...`.

### Andamento continua `text` livre no banco, curado na UI

Nenhuma outra tabela do projeto usa enum de banco pra status (mesmo padrão em `kinds.ts` pros
outros três kinds) — a validação vive no núcleo (`STATUS_LABELS`/lista de valores válidos em
`kinds.ts`), não em constraint de schema. Migração de vocabulário fica só código, sem migração de
banco.

Transições oferecidas pela tela do detalhe (curadas, refletindo o que o design mostra pra "Em
análise" e estendido pelo mesmo raciocínio pros demais andamentos):

| De | Pra |
|---|---|
| Novo | Em análise, Cancelado |
| Em análise | Aguardando pagamento, Indeferido, Cancelado |
| Aguardando pagamento | Pago, Cancelado |
| Pago | Concluído, Cancelado |
| Concluído | Arquivado |
| Indeferido | Arquivado |
| Cancelado | Arquivado |
| Arquivado | (nenhuma — terminal) |

O servidor valida contra a lista de 8 valores possíveis, não contra a tabela de transição — a
curadoria é só da UI (o design não trava o operador, só sugere o próximo passo comum). Isso evita
que uma correção manual legítima (ex.: voltar de "Cancelado" por engano) fique impossível só
porque não está na tabela.

### Contador da sidebar = pedidos fora de estado terminal

"Em aberto" pro badge da sidebar (e pro cabeçalho da fila) é `status NOT IN (concluded, rejected,
cancelled, archived)` — ou seja Novo, Em análise, Aguardando pagamento e Pago contam. Concluído,
Indeferido, Cancelado e Arquivado, não.

### Lançamento manual reaproveita o schema e a criação do cidadão

`serviceRequestSchema(act)` e `createServiceRequest()` são chamados como já são — sem schema
paralelo. A única diferença é `details.channel = "presencial"` (persistido, mostrado no histórico
como "lançado no balcão") e a ausência de honeypot/rate-limit (a rota já está atrás de sessão
autenticada com `requests.manage`).

### Exclusão é hard delete, auditada antes de apagar

"Excluir protocolo" remove a linha (cascata apaga anexos e exigências). Como a linha some, a
entrada de auditoria precisa carregar o que se perde: protocolo, nome do solicitante e ato,
gravados como texto na própria entrada de `audit_log` (não como FK) — auditoria sobrevive à
exclusão que descreve.

### Reemissão de chave é sobrescrita simples

`reissueAccessKey` gera chave nova, grava só o hash novo por cima do antigo — a chave antiga já
não bate com nenhum hash guardado, então já está invalidada; não precisa de tabela de chaves
revogadas.

## Risks / Trade-offs

- **Sem paginação na fila** → se uma serventia acumular milhares de pedidos, a tela degrada.
  Mitigação: `ponytail:` fila sem paginação, adicionar quando o volume real pedir (cursor por
  `createdAt`, já indexado).
- **Transição de andamento não é imposta no banco** → uma Server Action mal escrita no futuro
  poderia gravar uma transição sem sentido. Mitigação: validação central em
  `src/core/request/kinds.ts` (lista fechada de 8 valores) já barra valor inválido; a curadoria de
  transição é só UX, documentada aqui pra quem mexer depois não reinventar.
- **Exigência com um único anexo de resolução** → o design mostra sempre um anexo por exigência
  cumprida; se um cidadão precisar enviar mais de um arquivo pra cumprir uma exigência, o modelo
  atual não cobre. Mitigação: fora de escopo agora — abrir exigências mais granulares (uma por
  documento faltante) resolve sem mudar o modelo.

## Migration Plan

Migração Drizzle única, aditiva: coluna `amount_cents integer` (nullable) em `service_requests`;
tabela nova `service_request_requirements`. Nenhuma coluna removida ou renomeada — não precisa dos
dois deploys de migração destrutiva.
