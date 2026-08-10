## 1. Núcleo: setor da publicação

- [ ] 1.1 Adicionar `NOTICE_SECTOR_META` (sigla, nome, tipo de edital, explicação legal — texto do legado) ao lado de `NOTICE_SECTOR_ATTRIBUTION` em `src/core/tenant/gating.ts`
- [ ] 1.2 Em `src/core/publications/publication.ts`: campo `sector` no modelo e no schema do formulário — `marriageBanns` força `proclamas`, `publicNotice` exige setor entre os permitidos, `notice` força nulo
- [ ] 1.3 Testes do núcleo: derivação de proclamas, edital com setor fora das atribuições recusado, aviso com setor recusado

## 2. Banco

- [ ] 2.1 Coluna `sector` (text, anulável) em `office_publications`; gerar migração Drizzle (expand)
- [ ] 2.2 Avisar no PR/resumo: **rodar `pnpm db:migrate` antes do deploy**, como na `0007`

## 3. Painel

- [ ] 3.1 Select de setor no formulário de publicação, visível só para `publicNotice`, com opções de `noticeSectors(tenant)`; salvar/editar passando pelo schema do núcleo
- [ ] 3.2 Mostrar o setor na lista de publicações e na pré-visualização (paridade com o site)

## 4. Página pública

- [ ] 4.1 Substituir o `ComingSoon` de `src/app/(public)/editais/page.tsx`: server component lendo `livePublications`, filtrando avisos fora, agrupando por setor na ordem do gating, grupo "Editais da serventia" por último para setor nulo
- [ ] 4.2 Cabeçalho de setor com `NOTICE_SECTOR_META` (sigla, tipo, explicação legal) e âncora `#<setor>`; chips `data-notice-sector` no topo apontando para as âncoras, só de setores com vigente
- [ ] 4.3 Cada edital: título, corpo, "Publicado em <data>"; vazio honesto quando não há nenhum vigente
- [ ] 4.4 Conferir gating: seção `editais` desligada responde como as demais desligadas

## 5. Anexo do edital

- [ ] 5.1 Colunas de anexo (anuláveis) em `office_publications`: `attachment_stored_name`, `attachment_display_name`, `attachment_path`, `attachment_mime_type`, `attachment_size_bytes`; migração Drizzle
- [ ] 5.2 Em `savePublication`: aceitar o arquivo, validar com `storeAttachments`, gravar as colunas e apagar o anterior ao trocar
- [ ] 5.3 Dropzone no formulário, no padrão dos demais uploads do painel, mostrando o arquivo já anexado
- [ ] 5.4 Rota `src/app/(public)/editais/[id]/arquivo/route.ts`: serve inline só quando vigente; 404 caso contrário
- [ ] 5.5 Link "Ver o edital (PDF)" no cartão da página pública quando houver anexo

## 6. Testes e verificação

- [ ] 6.1 Ajustar `e2e/tenants.spec.ts`: chips renderizados ⊆ `noticeSectors(tenant)` e página 200 com shell
- [ ] 6.2 e2e (com banco): publicar edital com setor no painel e vê-lo em `/editais`; proclamas expirado não aparece; aviso vigente não aparece em `/editais`
- [ ] 6.3 `pnpm test`, `pnpm lint`, `pnpm typecheck`; conferir a página ao vivo nos dois casos (com e sem vigente)
