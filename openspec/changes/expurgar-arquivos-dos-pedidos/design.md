## Context

Todos os arquivos de um protocolo moram em `service_request_attachments`, separados por `kind`
(`citizen`, `signed-form`, `payment-receipt`, `office`, `rejection-document`,
`formulario-exigencia`) e por `requirementId`/`requirementMessageId` (formulário e mensagens da
exigência). A tabela serve os quatro tipos de protocolo; os arquivos de SOL e OUV também moram
aqui. Duas rotas servem esses arquivos: `/protocolo/documento` (cidadão, com protocolo e chave) e
`/admin/documento` (painel, com sessão).

Dois fatos do código moldam o desenho:

1. **Ninguém guarda quando o protocolo encerrou.** `updatedAt` muda a cada edição, e um pedido
   concluído pode ser reaberto (`done → processing` é transição permitida).
2. **O PR #180 já resolveu o mesmo problema nas publicações**: regra pura em
   `src/core/publications/attachment-retention.ts`, expurgo na leitura do painel
   (`purgeExpiredAttachments`), rota que responde 410 ao arquivo vencido. Este desenho segue o
   mesmo molde.

## Decisões confirmadas com o usuário (08/11/2026)

Têm implicação jurídica e foram confirmadas antes da implementação:

1. **Marco dos 30 dias: o encerramento.** Nada é apagado com o protocolo em andamento. Encerrado,
   cada arquivo fica até `max(dia do encerramento, dia do envio) + 30`. Reaberto, a contagem para.
   O documento entregue junto com a conclusão (o caso comum) fica exatamente os 30 dias prometidos.
2. **Requerimento assinado e comprovante de pagamento entram na regra**, com aviso: o painel mostra
   até quando cada arquivo fica e destaca os últimos 7 dias; a serventia baixa e guarda no próprio
   acervo o que precisar manter.
3. **Escopo: REQ, SOL e OUV.** A regra lê o encerramento pelo `isOpenStatus(kind, status)` de cada
   tipo; não há lista de tipos.
4. **Já encerrados: 30 dias a partir do deploy.** A migração dá `closed_at = now()` a todo
   protocolo já encerrado, como a `0031` fez com as publicações.

Os 30 dias são regra da plataforma, não da lei. O que a LGPD pede (art. 6º, III, e arts. 15 e 16) é
que o dado pessoal não seja guardado além da finalidade; ela não fixa prazo. Um pedido de serviço
cumpre a finalidade quando encerra; a serventia guarda no próprio acervo o que a legislação
registral ou notarial mandar guardar, como já faz com o papel.

## Goals / Non-Goals

**Goals:**
- A promessa feita ao cidadão passa a ser verdade.
- Nenhum arquivo some com o protocolo em andamento.
- O arquivo vencido não é servido por nenhuma rota, mesmo que o expurgo ainda não tenha passado.
- Cada apagamento fica na auditoria, sem autor (foi a plataforma).

**Non-Goals:** ver a proposta.

## Decisions

### 1. `service_requests.closed_at`, gravado em toda troca de status

Coluna `timestamptz` anulável. Toda escrita de status (`updateRequestStatusWith`,
`answerSearchWith`, `updateRecordStatus`, `respondToRecordWith`, e a criação com status inicial)
passa por `closedAtFor(kind, status)`: andamento aberto grava `null`; andamento terminal grava
`coalesce(closed_at, now())`, para que ir de "Concluído" a "Arquivado" não reinicie os 30 dias.

Alternativa descartada: ler o encerramento do `audit_log`. A auditoria registra que o andamento
mudou, não para qual (o mesmo fato que levou ao `pausedOn` do prazo).

### 2. Regra pura: `src/core/request/attachment-retention.ts`

`requestFileStatus({ hasFile, purged, uploadedOn, closedOn }, today)` devolve:

- `none` (nunca teve arquivo) ou `purged` (já apagado);
- `held` (protocolo em andamento: fica, sem data);
- `available` com `until` e `daysLeft` (encerrado, dentro dos 30 dias);
- `expired` com `until` (vencido, a apagar).

`requestFileServable(status)` é `held` ou `available`. As datas são do calendário da serventia
(`OFFICE_TIME_ZONE`), como no prazo e nas publicações. O aviso usa `FILE_WARNING_DAYS = 7`.

### 3. `path` anulável e `purged_at`

Apagado o arquivo, o `path` vira `null` e `purged_at` recebe a hora. O registro do anexo fica:
apagar a linha perderia nome, tipo e data, e a exigência aponta para o arquivo que a respondeu
(`resolutionAttachmentId`, sem cascata). Tirar o `NOT NULL` é expansão compatível: o código antigo
nunca vê `null`, porque só o código novo expurga.

### 4. Expurgo na leitura do painel

`purgeExpiredRequestFiles(tenantSlug, today)` busca os anexos com `path` preenchido de protocolos
com `closed_at` anterior a `today - 30` (filtro largo em SQL; a regra pura decide), zera o `path`
primeiro, apaga com `deleteStoredFile` depois (uma linha apontando para arquivo apagado seria link
quebrado; arquivo sem linha é só sobra) e grava `request.attachment-purge` na auditoria com
`targetType` do tipo do protocolo e `targetId` do protocolo, para aparecer no histórico dele.

Roda ao abrir a fila de pedidos, a fila da LGPD e a da ouvidoria. As rotas não dependem disso:
recusam pelo estado calculado.

### 5. Rotas respondem 410

`/protocolo/documento` e `/admin/documento` calculam o estado do arquivo antes de ler bytes:
vencido ou apagado responde `410 Gone` com texto curto em português. 410 e não 404 porque o
arquivo existiu e saiu por regra; quem segue um link antigo entende o motivo.

### 6. Telas

- **Painel**: o detalhe do protocolo mostra um aviso sobre os arquivos quando encerrado ("ficam
  até DD/MM", em destaque nos últimos 7 dias; "apagados em DD/MM" depois). `AttachmentRow` mostra
  o arquivo apagado sem "Ver" nem "Excluir".
- **Consulta pública**: depois do encerramento, "Disponível até DD/MM" no lugar de "por 30 dias";
  arquivo apagado aparece como "apagado em DD/MM, 30 dias depois do encerramento", sem Baixar.

## Risks / Trade-offs

- **Serventia perde arquivo que precisava guardar** → aviso de 7 dias no painel, 30 dias de graça
  para tudo que já está encerrado, e as serventias devem ser avisadas antes do deploy em produção.
- **Expurgo atrasado se ninguém abrir o painel** → aceito: as rotas já recusam o arquivo vencido,
  e o arquivo fica só no armazenamento até a próxima leitura.
- **Blob compartilhado entre Preview e produção** (`veridia-blob`) → o expurgo do Homolog só apaga
  arquivos que linhas do Homolog apontam; não alcança arquivo de produção.

## Migration Plan

1. `0032`: `ALTER TABLE service_requests ADD closed_at`, `ALTER TABLE service_request_attachments
   ADD purged_at`, `ALTER COLUMN path DROP NOT NULL`, backfill de `closed_at = now()` nos
   protocolos já encerrados, por tipo.
2. Homolog pelo pooler em modo sessão (porta 5432).
3. Produção manual, antes do merge, só com autorização nominal do usuário, depois de avisar as
   serventias.

Reverter: o código antigo convive com as colunas novas; só um arquivo já apagado não volta.
