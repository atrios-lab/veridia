## 1. Dados e regras puras

- [x] 1.1 Adicionar `posterPath: text("poster_path")` (anulável) à tabela `tutorials` em `src/db/schema.ts` e gerar a migração Drizzle
- [x] 1.2 Adicionar `posterUrl: string | null` à interface `Tutorial` (`src/core/tutorials/catalog.ts`) e mapeá-lo em `toTutorial` (`src/lib/tutorials.ts`), como o `captionsUrl`
- [x] 1.3 Em `src/core/tutorials/video.ts`: tipo `"poster"` com `image/jpeg`, `image/png` e `image/webp`, extensão pelo tipo, `MAX_POSTER_BYTES` de 2 MB, `tutorialFilePath` e o regex de caminho gerado aceitando `jpg|png|webp`, e `tutorialPathKind` reconhecendo a capa; cobrir em `video.test.ts`
- [x] 1.4 Em `src/core/tutorials/progress.ts`: `trailStatus(catalog, watchedIds)` devolvendo `start`, `progress` (com `watched` e `total`) ou `done`; cobrir em `progress.test.ts` os casos nenhum, parte, todos, trilha vazia e avulso assistido que não conta

## 2. Upload e gerenciamento da capa

- [x] 2.1 Rota `src/app/api/treinamento/upload/route.ts`: incluir os tipos de imagem e escolher o limite de tamanho pelo tipo do caminho (500 MB vídeo, 1 MB legenda, 2 MB capa); a regra de caminho e tipo fica em `video.ts`, testada lá
- [x] 2.2 `createTutorialWith` e `updateTutorialWith`: gravar `posterPath`; na edição, aceitar capa nova (anterior vai para `orphaned`) e remoção explícita (`posterPath` vira null e o arquivo vai para `orphaned`)
- [x] 2.3 `deleteTutorialWith`: incluir a capa nos caminhos devolvidos para apagar do store
- [x] 2.4 Cobrir 2.2 e 2.3 em `src/db/tutorials.test.ts` contra PGlite: criar com e sem capa, trocar, remover, excluir com capa
- [x] 2.5 Formulário de `/admin/ajuda/gerenciar`: campo opcional de capa (aceita JPEG, PNG, WebP; recusa acima de 2 MB antes do envio; dica de 1280×720), prévia da capa atual na edição e ação "Remover capa"; upload direto ao store com store configurado, server action em disco sem store
- [x] 2.6 Lista de gerenciamento: miniatura da capa (ou da capa tipográfica) ao lado de cada vídeo

## 3. Tela Treinamento em vitrine

- [x] 3.1 Componente de capa tipográfica (servidor): bloco 16:9 com fundo sólido do painel e o título em até três linhas
- [x] 3.2 Componente de card (servidor): capa ou capa tipográfica com `object-fit: cover`, duração e check de assistido sobre a capa, categoria em caixa alta, título em até duas linhas, tela ensinada na linha de metadados, `aria-current` e borda de destaque no card atual, link para `?video=<id>`
- [x] 3.3 Componente de prateleira: `<section aria-labelledby>` com título, contagem e subtítulo, `<ul>` com `scroll-snap` horizontal; setas como componente cliente que rola pela largura visível e se desabilita no início e no fim
- [x] 3.4 Destaque: reorganizar `TutorialPlayer` em duas colunas (vídeo à esquerda, texto à direita, empilhando abaixo de `lg`), com o selo de andamento em cor cheia e texto branco e a capa como `poster` do `<video>`
- [x] 3.5 `page.tsx`: montar o mapa rota → grupo do menu a partir de `ADMIN_NAV` (fallback "Painel"), calcular `trailStatus`, renderizar destaque, "Primeiros passos" (com "X de Y") e "Aprofundamento", omitindo prateleira vazia; manter o estado sem vídeos e a ação "Gerenciar vídeos"
- [x] 3.6 Remover `tutorial-list.tsx` e o que só ele usava

## 4. Conferência

- [x] 4.1 Rodar os testes tocados (`progress.test.ts`, `video.test.ts`, `src/db/tutorials.test.ts`) e `pnpm` de tipos e lint
- [x] 4.2 Conferir no navegador pelo host do cartório: destaque, prateleiras com rolagem, card sem capa, card atual, teclado percorrendo os cards e tela estreita (o painel não tem tema escuro; o selo "Trilha concluída" e a prateleira de aprofundamento só têm cobertura de teste, porque o Homolog não tem esses casos)
- [ ] 4.3 Aplicar a migração no Homolog pelo pooler e conferir no Preview com uma capa enviada de verdade

## 5. Produção

- [ ] 5.1 Antes do merge, aplicar a migração de `poster_path` em produção via `POSTGRES_URL_NON_POOLING`
