## 1. Regra e dados

- [x] 1.1 `src/core/request/attachment-retention.ts` puro, com teste: em andamento, dentro dos 30 dias, último dia, vencido, enviado depois do encerramento, apagado, nunca teve arquivo
- [x] 1.2 `closed_at` por tipo (REQ, SOL, OUV) via `isOpenStatus`, gravado em SQL (`coalesce`); teste em PGlite
- [x] 1.3 Schema: `service_requests.closed_at`, `service_request_attachments.purged_at`, `path` anulável; migração `0032` com backfill por tipo

## 2. Escrita e expurgo

- [x] 2.1 `closed_at` gravado em toda troca de status (`updateRequestStatusWith`, `answerSearchWith`, `updateRecordStatus`, `respondToRecordWith`, criação), sem reiniciar entre andamentos terminais
- [x] 2.2 `purgeExpiredRequestFiles(tenantSlug, today)`: zera o `path`, grava `purged_at`, apaga com `deleteStoredFile`, audita `request.attachment-purge` com `actorId: null`
- [x] 2.3 Chamar o expurgo nas filas de pedidos, LGPD e ouvidoria
- [x] 2.4 Leitores de `path` tratam `null` (exclusão de anexo e de exigência)

## 3. Rotas e telas

- [x] 3.1 `/protocolo/documento` e `/admin/documento` respondem 410 ao arquivo vencido ou apagado
- [x] 3.2 Painel: aviso de prazo dos arquivos no detalhe encerrado; `AttachmentRow` sem "Ver"/"Excluir" no apagado; histórico rotula o expurgo
- [x] 3.3 Consulta pública: "até DD/MM" depois do encerramento; apagado sem Baixar

## 4. Entrega

- [x] 4.1 Migração aplicada no Homolog pelo pooler (porta 5432) em 08/11/2026: 72 protocolos encerrados receberam `closed_at`
- [ ] 4.2 Avisar as serventias antes de aplicar em produção (fora do código)
- [x] 4.3 Migração de produção, autorizada pelo usuário e aplicada em 08/11/2026 antes do merge: 351 protocolos encerrados (350 REQ, 1 OUV) com 306 arquivos ganharam `closed_at`, prazo até 08/12/2026
- [ ] 4.4 Depois do merge, rodar de novo o backfill (`UPDATE ... SET closed_at = now() WHERE closed_at IS NULL AND <encerrado>`) para os protocolos encerrados entre a migração e o deploy, que o código antigo não marca

## 5. Fora deste PR (conhecido)

- [ ] 5.1 Links soltos para arquivo (formulário e mensagens da exigência, comprovante no valor, documento do indeferimento no painel) ainda aparecem para arquivo vencido; a rota responde 410 com a explicação
- [ ] 5.2 O detalhe da ouvidoria não lista os anexos da manifestação (lacuna anterior a esta change); o expurgo os alcança mesmo assim
