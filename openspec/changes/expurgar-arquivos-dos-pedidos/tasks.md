## 1. Regra e dados

- [ ] 1.1 `src/core/request/attachment-retention.ts` puro, com teste: em andamento, dentro dos 30 dias, último dia, vencido, enviado depois do encerramento, apagado, nunca teve arquivo
- [ ] 1.2 `closedAtFor(kind, status)` no núcleo, com teste por tipo (REQ, SOL, OUV)
- [ ] 1.3 Schema: `service_requests.closed_at`, `service_request_attachments.purged_at`, `path` anulável; migração `0032` com backfill por tipo

## 2. Escrita e expurgo

- [ ] 2.1 `closed_at` gravado em toda troca de status (`updateRequestStatusWith`, `answerSearchWith`, `updateRecordStatus`, `respondToRecordWith`, criação), sem reiniciar entre andamentos terminais
- [ ] 2.2 `purgeExpiredRequestFiles(tenantSlug, today)`: zera o `path`, grava `purged_at`, apaga com `deleteStoredFile`, audita `request.attachment-purge` com `actorId: null`
- [ ] 2.3 Chamar o expurgo nas filas de pedidos, LGPD e ouvidoria
- [ ] 2.4 Leitores de `path` tratam `null` (exclusão de anexo e de exigência)

## 3. Rotas e telas

- [ ] 3.1 `/protocolo/documento` e `/admin/documento` respondem 410 ao arquivo vencido ou apagado
- [ ] 3.2 Painel: aviso de prazo dos arquivos no detalhe encerrado; `AttachmentRow` sem "Ver"/"Excluir" no apagado; histórico rotula o expurgo
- [ ] 3.3 Consulta pública: "até DD/MM" depois do encerramento; apagado sem Baixar

## 4. Entrega

- [ ] 4.1 Migração aplicada no Homolog pelo pooler (porta 5432)
- [ ] 4.2 Avisar as serventias antes de aplicar em produção (fora do código)
- [ ] 4.3 Migração de produção, só com autorização nominal do usuário, antes do merge
