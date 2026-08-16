# Design — Service Request Legacy Parity

## Context

O legado (cartorio-marinho, NestJS + Prisma) implementa tudo isto em produção; o veridia tem a fundação equivalente (protocolo, chave hasheada, exigência com formulário, entrega, auditoria) mas sem a conversa, sem e-mails no canal, sem aceites persistidos e com 8 andamentos. A infra que cada gap precisa já existe no veridia: `src/lib/email` (usada só por convites), `storeAttachments`, `attachToRequest`, `rate-limit.ts`, honeypot (`looksLikeBot`), `<ConfirmAction>` + `recordAudit` + check:destructive, e o padrão `details` jsonb parseado pelo core.

Referências de comportamento no legado: `pedidos-admin.service.ts` (e-mails, exigência, cumprimento), `MensagemExigencia` no schema Prisma (autor em coluna própria, anexos por FK da mensagem), `estado.ts` (fluxo livre, recusa só o mesmo estado).

## Goals / Non-Goals

**Goals:**

- Conversa da exigência fiel ao design aprovado (card único: exigência + conversa; encerra no cumprimento).
- Cumprimento como ato do operador; envio do cidadão nunca cumpre sozinho.
- Os 5 avisos de e-mail do legado, com as mesmas regras (sem conteúdo; fire-and-forget; só quando o contato é e-mail).
- 18 andamentos: os 10 do fluxo registral do legado somados aos 8 atuais, no vocabulário do veridia.
- Aceites persistidos com data.

**Non-Goals:**

- Retenção/expurgo (change própria).
- Migração dos dados do legado para o veridia (change própria de migração; esta change só cobre o vocabulário e documenta o de-para).
- Conversa em outros canais (LGPD, ouvidoria) ou no pedido fora de exigência.
- Notificação por WhatsApp/SMS quando o contato é telefone.

## Decisions

**1. Identificadores de andamento: manter inglês, acrescentando os 10 registrais.**
Os 8 atuais ficam como estão; entram `filed`, `pre-noted`, `in-qualification`, `with-requirement`, `awaiting-compliance`, `processing`, `registered`, `annotated`, `granted`, `ready-for-pickup`. Nenhum dado do veridia é migrado — a lista só cresce.

A primeira versão deste design mandava adotar os identificadores em português do legado, para que a futura migração legado→veridia fosse cópia direta da coluna. A implementação mostrou que a premissa estava errada: **`service_requests.status` é uma coluna só, compartilhada pelos quatro canais** (`kind` é que distingue), e `new`, `in-review`, `done` e `cancelled` já são usados por agendamento, LGPD e ouvidoria. Renomear só os do pedido deixaria `em_qualificacao` e `confirmed` convivendo na mesma coluna — o "vocabulário misto para sempre" que aquela decisão dizia estar evitando. E o custo que ela temia (de-para na migração) é de ~18 linhas num script que roda uma vez, contra uma inconsistência permanente no schema.

Consequência prática: some da change o UPDATE de dados (e o risco de renomear linha de outro canal por engano num WHERE sem `kind`). O de-para pt→en fica documentado abaixo, para a change de migração de dados usar.

| Legado (pt) | Veridia (en) | | Legado (pt) | Veridia (en) |
| --- | --- | --- | --- | --- |
| `novo` | `new` | | `em_processamento` | `processing` |
| `em_analise` | `in-review` | | `registrado` | `registered` |
| `aguardando_pagamento` | `awaiting-payment` | | `averbado` | `annotated` |
| `pago` | `paid` | | `deferido` | `granted` |
| `protocolado` | `filed` | | `indeferido` | `rejected` |
| `prenotado` | `pre-noted` | | `disponivel_retirada` | `ready-for-pickup` |
| `em_qualificacao` | `in-qualification` | | `concluido` | `done` |
| `com_exigencia` | `with-requirement` | | `cancelado` | `cancelled` |
| `aguardando_exigencia` | `awaiting-compliance` | | `arquivado` | `archived` |

**2. Fluxo livre, como o legado.** `transicaoPermitida(de, para) = de !== para`. O veridia já era livre (sugestões são UX, não gate); a única regra nova é recusar a transição para o mesmo andamento — evento sem informação. `SUGGESTED_NEXT_STATUSES` reescrito para os 18 com curadoria do fluxo registral; a fila colapsa em fases (agrupamento visual definido em `kinds.ts`, ex.: entrada → análise → registro → entrega → encerrado).

**3. Conversa: tabela própria + anexos pendurados na mensagem via coluna nova.**
`service_request_requirement_messages`: id, tenantSlug, requirementId (FK cascade), `author` text (`citizen` | `staff`) em coluna própria (deduzir de authorUserId nulo quebra quando a conta some — lição documentada no legado), `authorUserId` nullable (SetNull), `body` text, createdAt. Anexos: coluna `requirement_message_id` nullable em `service_request_attachments` (FK cascade para a mensagem) — o dono continua o pedido (requestId preenchido), como o legado faz, para o expurgo futuro achar o arquivo pelo pedido. Até 3 por mensagem, `kind: "citizen"`.

**4. Cumprimento desacoplado do anexo.** `fulfillRequirement` (cidadão) morre; nasce `resolveRequirement(tenantSlug, requirementId, actorId)` — ação do painel, audita `service-request.requirement.fulfill` com o operador como ator. O envio de arquivo do cidadão na exigência vira mensagem na conversa (com anexo). `resolutionAttachmentId` deixa de ser escrito em novos cumprimentos (a prova do cumprimento é a conversa); a coluna fica para as linhas históricas.

**5. Estado da conversa é derivado, nunca gravado.** "Respondida" = última mensagem é da serventia; "Novo" (aguardando serventia) = última é do cidadão; "Encerrada" = exigência cumprida. Zero colunas de estado — mesma filosofia do `publicationState`.

**6. E-mails: um helper no canal, gatilhos nas funções de dados.**
`src/lib/email/service-request.ts` com `notifyCitizen({tenantSlug, contact, protocolNumber, subject, body})`: retorna cedo se o contato não parece e-mail (regex simples), `void`ado com catch e log — fire-and-forget de verdade, nunca no caminho do erro da ação. Gatilhos: criação pelo site (action do solicitar), `registerRequirement`, resposta staff na conversa, `updateRecordStatus` quando `para ∈ {concluido, cancelado}` e kind é service-request, `deliverDocument`. Textos iguais aos do legado (sem conteúdo, só instrução de consultar).

**7. Aceites em `details`, sem migração de schema.** O form schema do core passa a emitir `details.consents = { lgpd: <iso>, truth: <iso> }` no parse do pedido; `details` já é jsonb parseado pelo core. Prova com data, zero coluna nova. Pedidos anteriores: sem a chave — ausência lê como "anterior ao registro de consentimento", como o legado trata `false`.

**8. UI da conversa (design aprovado).** Dentro do card da exigência nos dois lados: avatar de iniciais (cidadão em accent, serventia em primary), nome + data/hora, corpo; pill de estado no cabeçalho do card; badge "Novo" no painel quando aguardando serventia; campo de resposta + botão no rodapé, removido quando encerrada. Lado do cidadão idem com o campo de escrever + anexos (padrão do dropzone). Polling não: a consulta já é request/response; a conversa atualiza no reload/ação (o chat de atendimento existe para tempo real — esta conversa é assíncrona por natureza).

**9. Rate limit e isca na escrita do cidadão.** Mesmo padrão da rota de mensagem do chat: limite próprio (20/min) via `rate-limit.ts`, honeypot `website` no form da consulta, resposta neutra 404 para protocolo/chave inválidos.

## Risks / Trade-offs

- **[Coluna `status` compartilhada pelos quatro canais]** → a lista de andamentos do pedido só cresce e nada é renomeado, então nenhuma linha de agendamento, LGPD ou ouvidoria é tocada. Toda leitura de status já passa por `kind` (`TERMINAL_STATUSES`, `STATUS_LABELS`), e é isso que mantém os vocabulários separados apesar da coluna única.
- **[18 opções num select intimida]** → o select agrupa por fase (optgroup) e as sugestões curadas continuam em destaque; o operador do legado já vive nesse vocabulário.
- **[Conversa vira canal de suporte paralelo ao chat]** → o card só existe dentro de exigência pendente; encerra no cumprimento; o texto da UI orienta ("sobre esta exigência").
- **[E-mail síncrono na serverless atrasa a ação]** → `void notify().catch(log)` — não aguardado; pior caso o aviso se perde, nunca a ação.
- **[Excluir exigência apaga arquivo de mensagem do cidadão]** → é o desenho (a exigência é o dono); confirmação nomeia a consequência e a auditoria registra, padrão do painel.

## Migration Plan

1. `pnpm db:generate` (tabela de mensagens + coluna em attachments); revisar linha a linha; commit junto. **Sem SQL de dados**: os andamentos novos só existem para linhas futuras.
2. `pnpm db:migrate` é do usuário (dev = produção).
3. Deploy puramente aditivo (tabela nova, coluna nullable, lista de andamentos maior). Rollback = reverter o deploy; nenhuma linha existente muda de valor.

## Open Questions

- Nome exibido do cidadão na conversa: `applicantName` do pedido (decisão default) — confirmar que pedidos manuais sempre o têm.
- Fases da fila (agrupamento dos 18 para a barra): proposta default — Entrada (novo, protocolado), Análise (em_analise, prenotado, em_qualificacao, com_exigencia, aguardando_exigencia), Pagamento (aguardando_pagamento, pago), Processamento (em_processamento, registrado, averbado, deferido), Entrega (disponivel_retirada), Encerrado (concluido, indeferido, cancelado, arquivado). Ajustável com a serventia.
