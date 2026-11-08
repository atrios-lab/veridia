## 1. Núcleo

- [x] 1.1 `notice-schedule.ts`: publicações, carência e fim do prazo, em dias úteis ou corridos, vencimento prorrogado para dia útil
- [x] 1.2 `notice-types.ts`: catálogo com os 11 tipos do design, `publicationHeadline` (tipo exato, publicação em curso, prazo)
- [x] 1.3 `publicationSectionTitle` e `noticeType` no schema do formulário (recusa tipo desconhecido ou de outro setor)
- [x] 1.4 `defaultExpiry` passa a vir do catálogo; testes em `node --test`

## 2. Dados

- [x] 2.1 Coluna `notice_type` em `office_publications` (migração 0030, aditiva)
- [x] 2.2 Aplicar no Homolog pelo pooler

## 3. Telas

- [x] 3.1 Painel: tipo de edital, data retroativa, cronograma calculado, aviso de prazo encerrado, rótulo do anexo para qualquer tipo, prévia com o mesmo rótulo do site
- [x] 3.2 Lista do painel com o rótulo do tipo e o fim do prazo
- [x] 3.3 Página inicial: título da seção pelo que está no ar, rótulo exato, prazo, anexo (imagem no cartão, PDF como link), ordem pela publicação em curso
- [x] 3.4 `/editais`: rótulo, republicação com a data da 1ª, prazo com o dispositivo legal, anexo
- [x] 3.5 Rota `/publicacoes/[id]/arquivo` para qualquer tipo; `/editais/[id]/arquivo` reexporta

## 4. Conferência e produção

- [x] 4.1 Testes tocados, `pnpm typecheck`, `pnpm lint`
- [x] 4.2 Conferido no navegador contra o Homolog (tenant de demonstração): aviso com imagem, edital retroativo de usucapião, formulário com o cronograma; linhas de teste apagadas
- [x] 4.3 Migração 0030 aplicada em produção via `POSTGRES_URL_NON_POOLING` em 08/11/2026 (31 migrações; as 3 publicações existentes ficaram sem tipo)
- [ ] 4.4 Conferir com a serventia as decisões ambíguas do design (proclamas 15 dias ou 5; contagem em dias úteis) e o Código de Normas da CGJ-RN

## 5. Anexo que sumia e exclusão (pedido de 08/11/2026)

- [x] 5.1 Formulário envia o anexo direto ao Blob (`useAttachmentPrepare`, limite de 1) e a ação usa `collectAttachments`; mostra "Enviando arquivo…" e o erro do envio
- [x] 5.2 Rota do anexo redireciona (307, `no-store`) para o blob em vez de repassar os bytes
- [x] 5.3 Depois de salvar, o formulário esquece o arquivo escolhido e, numa publicação nova, limpa os campos (um segundo clique em "Publicar" duplicava a publicação)
- [x] 5.4 "Excluir" com confirmação em todas as abas; apaga a linha, o arquivo e registra auditoria; conferido no navegador contra o Homolog
- [ ] 5.5 Conferir no Preview (com Blob) uma foto acima de 4,5 MB publicada direto

## 6. Detalhe da publicação (pedido de 08/11/2026)

- [x] 6.1 Tela `/admin/publicacoes/[id]` com dados, prazos, texto e anexo; título e botão "Ver" na lista
- [x] 6.2 Rota `/admin/publicacoes/[id]/arquivo` para qualquer estado (sessão com `content.edit`)
- [x] 6.3 Editar liberado nas arquivadas; Excluir pelo detalhe volta para a lista (redirect no servidor)
- [x] 6.4 Conferido no navegador contra o Homolog; linhas de teste apagadas
