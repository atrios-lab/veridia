# Tasks — Service Request Legacy Parity

## 1. Core: andamentos e consentimento

- [x] 1.1 Ampliar a lista em `src/core/request/kinds.ts` para 18 identificadores em inglês (os 8 atuais + `filed`, `pre-noted`, `in-qualification`, `with-requirement`, `awaiting-compliance`, `processing`, `registered`, `annotated`, `granted`, `ready-for-pickup`), labels em pt, `TERMINAL_SERVICE_REQUEST_STATUSES` (concluido, indeferido, cancelado, arquivado), recusa de transição para o mesmo andamento, `SUGGESTED_NEXT_STATUSES` curado para os 18 e o agrupamento em fases da fila; atualizar testes do core
- [x] 1.2 Form schema do core emite `details.consents = {lgpd, truth}` com timestamp no parse do pedido; teste de que o consent sai no details e de que a ausência valida como antes
- [x] 1.3 Conferido: o único consumidor que assumia 8 era o `StatusBadge` (pego pelo typecheck) — agora colore por fase, com override só para os finais; filtros da fila e contadores leem a lista, não a enumeram; os outros canais seguem com o próprio vocabulário na coluna compartilhada

## 2. Schema e migração

- [x] 2.1 `service_request_requirement_messages` (author em coluna própria, authorUserId SetNull, FK cascade da exigência) + coluna `requirement_message_id` em `service_request_attachments`; `pnpm db:generate`
- [x] 2.2 Revisar o SQL gerado linha a linha (deve ser puramente aditivo, sem UPDATE de dados); **não** rodar db:migrate (usuário roda)

## 3. Dados (`src/lib/service-request.ts`)

- [x] 3.1 Conversa: `listRequirementMessages`, `writeCitizenMessage` (valida exigência pendente + até 3 anexos presos à mensagem e ao pedido), `writeStaffMessage` (audita; dispara aviso), estado derivado (respondida/aguardando/encerrada)
- [x] 3.2 Cumprimento: substituir `fulfillRequirement` por `resolveRequirement` (ação de operador, audita com ator); envio de arquivo do cidadão na exigência vira mensagem com anexo
- [x] 3.3 Exigência: `updateRequirementText` e `deleteRequirement` (pendente apenas; delete remove mensagens + arquivos físicos + `recordAudit` na própria função — check:destructive)
- [x] 3.4 Balcão: action de anexar documento do cidadão via `attachToRequest` existente
- [x] 3.5 E-mail: `src/lib/email/service-request.ts` (`notifyCitizen`, só contato-email, fire-and-forget) e gatilhos — criação (action do solicitar), `registerRequirement`, resposta staff, `updateRecordStatus` para concluido/cancelado, `deliverDocument`

## 4. Painel

- [x] 4.1 Card da exigência: conversa embutida (avatares de iniciais, autor, hora), pill de estado, badge "Novo" quando aguardando serventia, campo "Responder ao cidadão…" + "Enviar resposta" (some quando cumprida)
- [x] 4.2 Botão "Marcar como cumprida" (ação do operador) e, em pendente, "Editar" e "Excluir" (excluir via `<ConfirmAction>` nomeando a consequência: conversa e arquivos somem)
- [x] 4.3 Andamento: select com os 18 agrupados por fase (optgroup), sugestões curadas em destaque; fila com barra colapsada em fases
- [x] 4.4 Seção de documentos do cidadão ganha o upload do balcão (dropzone padrão)

## 5. Consulta do cidadão

- [x] 5.1 Card da exigência: conversa embutida (mesmo desenho), campo de escrever com até 3 anexos, honeypot e rate limit próprio na action; encerrada quando cumprida
- [x] 5.2 O envio de cumprimento atual vira mensagem com anexo (exigência continua pendente até o cartório cumprir); textos da UI ajustados ("a serventia confere e marca como cumprida")
- [x] 5.3 Download de anexo de mensagem pela rota `/protocolo/documento` existente (protocolo + chave no corpo); `requestOwnAttachments` passa a excluir anexos de mensagem, senão eles apareceriam duplicados na lista geral de documentos do cidadão

## 6. Verificação

- [x] 6.1 `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm check:dashes` (arquivos novos), `pnpm check:destructive`
- [x] 6.2 Browser (banco real, migração 0013 aplicada, sessão do painel): conversa ponta a ponta — exigência registrada → cidadão escreve pela consulta com chave (`author: citizen`, sem userId) → badge "Novo" no painel → serventia responde (`author: staff` com operador, audit `requirement.reply`) → badge vira "Respondida" sozinho (estado derivado) → cidadão vê os dois lados → cartório marca cumprida (audit `fulfill` **com ator**) → conversa encerra nos dois lados, histórico legível. Andamentos: 18 em 6 fases, "Prenotado" persiste como `pre-noted`, sugestões seguem o fluxo registral, transição para o mesmo andamento recusada. Excluir exigência: diálogo → cascade leva a mensagem + audit. Dados de teste limpos. **Não verificado:** os e-mails (o dev server é do usuário; não leio o log dele).
- [x] 6.3 e2e: `admin-requirement-conversation.spec.ts` com 4 cenários (responder na conversa, cumprir só pelo cartório encerrando a conversa, excluir pelo diálogo, andamentos registrais agrupados) + gate de sessão; cleanup por protocolo REQ.2098.000777 (cascade leva mensagens e arquivos). **Não executada**: depende de credenciais e da migração.
