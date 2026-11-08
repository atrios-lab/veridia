## Why

A consulta do protocolo promete ao cidadão que o documento "fica disponível por 30 dias"
(`acompanhar/protocol-trilho.tsx`, `protocolo/protocol-lookup.tsx`), mas nada no código apaga
arquivo de pedido: os anexos ficam no armazenamento para sempre, e o schema só menciona "a future
purge". A promessa é falsa nas duas direções: o arquivo não some, e a serventia guarda dado pessoal
(documentos de identidade, certidões, comprovantes) sem prazo. A LGPD pede que o dado não seja
guardado além da finalidade (art. 6º, III, e arts. 15 e 16); o número de 30 dias é regra da
plataforma, o mesmo que o PR #180 aplicou ao arquivo das publicações.

## What Changes

- Todo arquivo de um protocolo (REQ, SOL e OUV; a regra não distingue o tipo) **fica enquanto o
  protocolo está em andamento** e é **apagado 30 dias depois do encerramento** (concluído,
  indeferido, cancelado, arquivado, respondido, conforme o tipo). Um arquivo enviado depois do
  encerramento conta os 30 dias do próprio envio.
- Vale para todos os tipos de anexo: o que o cidadão enviou, o requerimento e a declaração
  assinados, o comprovante de pagamento, o documento entregue, o documento do indeferimento, o
  formulário da exigência e os arquivos das mensagens da exigência.
- Reabrir o protocolo (voltar a um andamento aberto) suspende a contagem; encerrar de novo começa
  outros 30 dias.
- O protocolo ganha `closed_at` (quando encerrou); o anexo ganha `purged_at` e o `path` passa a
  aceitar nulo. Apagado o arquivo, fica o registro: nome, tipo, tamanho, data de envio e quando foi
  apagado.
- O expurgo roda quando o painel lê (fila de pedidos, LGPD, ouvidoria), sem tarefa agendada, e
  cada arquivo apagado deixa `request.attachment-purge` na auditoria, sem autor (`actorId: null`).
- As rotas de documento (consulta pública e painel) **recusam com 410** o arquivo vencido, mesmo
  antes de o expurgo passar por ele.
- O painel mostra até quando os arquivos ficam, destaca os últimos 7 dias e marca os apagados; a
  consulta pública troca "por 30 dias" por "até DD/MM" depois do encerramento e tira o botão
  Baixar do arquivo apagado.
- Protocolos já encerrados na data do deploy recebem `closed_at = now()`: os 30 dias contam do
  deploy, para as serventias serem avisadas e baixarem o que quiserem guardar.

## Non-goals

- Apagar o protocolo, o texto, as mensagens ou o histórico: só os arquivos saem.
- Prazo por serventia ou por tipo de ato: a regra é uma só, da plataforma.
- Tarefa agendada (cron): o expurgo segue a postura "calculado na leitura" das publicações.
- Aviso por e-mail ao cidadão ou à serventia antes do expurgo.
- Arquivos do atendimento (chat), da adequação e dos treinamentos: outras regras, fora daqui.
- Agendamentos (AGD): não têm anexo hoje; a regra os cobriria sem mudança se passassem a ter.

## Capabilities

### New Capabilities

(nenhuma)

### Modified Capabilities

- `service-request`: os arquivos do protocolo têm prazo e a consulta mostra até quando ficam.
- `admin-service-requests`: o painel mostra o prazo dos arquivos, expurga os vencidos e recusa
  servir arquivo vencido.

## Impact

- `src/core/request/attachment-retention.ts` (novo, puro, com teste).
- `src/db/schema.ts` e migração `0032`: `service_requests.closed_at`,
  `service_request_attachments.purged_at`, `path` anulável, backfill do `closed_at`.
- `src/lib/service-request.ts`: `closed_at` gravado em toda troca de status; `purgeExpiredRequestFiles`.
- Rotas `src/app/(public)/protocolo/documento/route.ts` e `src/app/admin/(dashboard)/documento/`.
- Telas do painel (pedidos, LGPD, ouvidoria) e da consulta (`acompanhar`, `protocolo`).
- Migração de produção é manual e precisa acontecer antes do merge.
