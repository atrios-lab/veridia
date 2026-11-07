## Context

`/admin/ajuda` hoje renderiza, no servidor, um `TutorialPlayer` (cliente, `<video>` nativo) e
um `TutorialList` (servidor, links `?video=`) numa grade `1fr 348px`. O vídeo atual é o do
`?video=`, ou `nextUnwatched()`, ou o primeiro de `listOrder()`. O catálogo é a tabela
`tutorials` (mesmas linhas para toda serventia), lida por `src/lib/tutorials.ts` e mapeada
para a interface `Tutorial` de `src/core/tutorials/catalog.ts`. Os arquivos vão ao Blob store
sob `treinamento/`, por token emitido em `src/app/api/treinamento/upload/route.ts`, que só
aceita os caminhos gerados por `tutorialFilePath()` e os tipos de `TUTORIAL_MIME_TYPES`.

A CSP do painel já inclui o host do store em `img-src` (`src/lib/csp.ts`), então uma capa
servida pelo store carrega sem mudar a política.

A referência visual é a biblioteca de tutoriais da Numera: destaque "Comece por aqui", busca
e chips, prateleiras com rolagem lateral e cards com capa desenhada, duração no canto e
categoria em caixa alta. Desta change entram o destaque, as prateleiras e os cards; busca e
chips ficam de fora (ver proposal).

## Goals / Non-Goals

**Goals:**
- Destaque com o player e um selo de andamento derivado da trilha.
- Prateleiras "Primeiros passos" e "Aprofundamento" com cards de capa, sem biblioteca.
- Capa opcional por vídeo, com reserva tipográfica que não depende de nenhum arquivo.
- Manter tudo o que a spec atual exige de cada item: título, duração, tela ensinada e marca de
  assistido.

**Non-Goals:**
- Busca, chips, modal de vídeo, capa gerada de frame, categoria editável (ver proposal).
- Mudar o card da trilha na Visão geral ou o link "Como usar esta tela".

## Decisions

### 1. O destaque é o player, e o selo vem de uma função pura

O destaque substitui o `TutorialPlayer` atual, mantendo o mesmo componente cliente: o vídeo
ocupa a coluna da esquerda e o texto (selo, título, descrição, tela ensinada, botão de
assistido) a da direita, empilhando abaixo de `lg`.

O selo sai de uma função nova em `progress.ts`:

```
trailStatus(catalog, watchedIds) →
  { kind: "start" }                       nenhum da trilha assistido (ou trilha vazia)
  { kind: "progress", watched, total }    alguns assistidos
  { kind: "done" }                        todos assistidos
```

O texto ("Comece por aqui", "Continue de onde parou · 2 de 7", "Trilha concluída") fica na
tela; a função só classifica, e por isso é testável sem DOM. Uma trilha vazia (só vídeos de
aprofundamento publicados) cai em `start`, com o texto "Comece por aqui", porque é o que a
pessoa vê sem ter assistido nada.

O selo usa cor cheia com texto branco (o padrão de destaque do painel), não fundo tingido.

*Alternativa considerada*: selo fixo "Comece por aqui", como na referência. Descartada porque
a tela já sabe o andamento da pessoa e um "comece por aqui" para quem terminou a trilha
engana.

### 2. Prateleiras são CSS `scroll-snap`, e só as setas são cliente

Cada prateleira é uma `<section aria-labelledby>` com cabeçalho (título, contagem, subtítulo)
e uma `<ul>` com `overflow-x: auto`, `scroll-snap-type: x mandatory` e cards de largura fixa
com `scroll-snap-align: start`. Os cards são links do servidor, como os itens da lista de hoje,
então o teclado percorre a prateleira por Tab e o navegador rola o card focado para a vista.

As setas são um componente cliente pequeno que chama `scrollBy` na largura visível da lista e
se desabilita no início e no fim (escutando `scroll`). Sem JavaScript, a prateleira continua
rolável com o trackpad, a roda ou o toque.

- "Primeiros passos": vídeos com `trail`, na ordem de posição; o título leva "X de Y".
- "Aprofundamento": os demais, na ordem de posição; o título leva a contagem.
- Prateleira sem vídeo não é renderizada.

*Alternativa considerada*: grade que quebra linha, sem rolagem lateral. Mais simples e sem
cliente, mas perde o ritmo da referência e empurra o aprofundamento para longe quando a
trilha cresce. Fica como reserva caso a rolagem lateral se mostre ruim no uso real.

### 3. Categoria derivada da rota, sem coluna

O eyebrow do card é o `group` do item de `ADMIN_NAV` cujo `href` é a rota ensinada
("Operação", "Canais do cidadão", "Serventia"); um vídeo sem rota mostra "Painel". O rótulo
da tela ("Pedidos de serviço") continua aparecendo, agora na linha de metadados do card, para
cumprir o requisito de mostrar a tela ensinada.

O mapa é montado em `page.tsx`, como o `SCREEN_LABELS` de hoje, porque `ADMIN_NAV` é do app e
`src/core/` não o importa.

*Alternativa considerada*: coluna `category` editável. Descartada: duplica o que o menu já diz
e abre espaço para os dois divergirem.

### 4. Capa: novo tipo de arquivo no mesmo caminho de upload

`TutorialFileKind` ganha `"poster"`, com os tipos `image/jpeg`, `image/png` e `image/webp`,
extensão derivada do tipo (`jpg`, `png`, `webp`) e limite de 2 MB. `tutorialFilePath("poster",
id, mime)` gera `treinamento/<id>.<ext>`, e o regex de caminho gerado passa a aceitar essas
extensões. A rota de token não muda de forma: continua validando o caminho com
`isGeneratedTutorialPath` e passa a incluir os tipos de imagem em `allowedContentTypes`, com o
limite de tamanho escolhido pelo tipo do caminho.

O banco ganha `tutorials.poster_path text null`; `Tutorial` ganha `posterUrl: string | null`,
montado em `src/lib/tutorials.ts` como o `captionsUrl`. No formulário de gerenciamento, o
campo é opcional na criação e, na edição, permite trocar ou remover a capa. Trocar ou remover
apaga o arquivo anterior do store; excluir o vídeo apaga também a capa. Sem store
(desenvolvimento), a imagem vai pela server action e é gravada em `public/uploads/treinamento/`,
como os demais arquivos.

O `<video>` do destaque usa a capa como `poster` quando existe.

*Alternativa considerada*: capa a partir de um frame do vídeo (`#t=3` com `preload=metadata`).
Descartada: carrega os metadados de cada vídeo da prateleira e o frame costuma ser uma tela
pela metade.

### 5. Capa tipográfica como reserva

Sem `posterUrl`, o card renderiza um bloco 16:9 em CSS: fundo sólido do painel, o título em
peso alto e tamanho grande, cortado em três linhas, alinhado embaixo à esquerda. É um
componente de servidor, sem imagem, e garante que um vídeo recém-publicado sem capa não deixe
um buraco na prateleira. A duração e a marca de assistido ficam sobre a capa, seja ela imagem
ou tipográfica, no mesmo lugar.

### 6. Card atual e marca de assistido

O card do vídeo que está no destaque leva `aria-current="true"` e uma borda de destaque; a
marca de assistido é um círculo de check no canto superior da capa, mais o texto oculto
"(assistido)" como hoje. A numeração da lista atual sai: a ordem é visual na prateleira e o
contador "X de Y" já diz o andamento.

## Risks / Trade-offs

- [Prateleira com rolagem esconde vídeos fora da vista] → as setas e o recorte do último card
  na borda indicam que há mais; o contador no título diz quantos são.
- [Capas enviadas com proporções diferentes] → o card força 16:9 com `object-fit: cover`; o
  formulário avisa a proporção recomendada (1280×720).
- [Arquivo de capa órfão se a troca falhar no meio] → a ordem é a mesma da troca de vídeo:
  grava a linha com o caminho novo e só então apaga o antigo; uma falha deixa no máximo um
  arquivo sobrando, nunca uma linha apontando para o nada.
- [Coluna nova em produção sem migração] → a coluna é anulável e lida com `select` explícito;
  a migração de produção roda antes do merge (ver Migration Plan), porque o deploy só roda
  `next build`.
- [Cache do store ao trocar uma capa pelo mesmo caminho] → trocar a capa por outra do mesmo
  tipo regrava `treinamento/<id>.<ext>`; seguir o que a troca de vídeo já faz para invalidar
  (sufixo ou `cacheControlMaxAge`), conferindo na implementação.

## Migration Plan

1. Gerar a migração Drizzle que adiciona `poster_path` à tabela `tutorials`.
2. Aplicar no Homolog pelo pooler (porta 5432 como `DIRECT_URL`) e conferir no Preview.
3. Antes do merge, aplicar em produção via `POSTGRES_URL_NON_POOLING`.
4. Merge e deploy. Os vídeos existentes aparecem com a capa tipográfica até a plataforma
   enviar as capas.

Rollback: a coluna é anulável e a versão anterior do app não a lê; reverter o deploy basta, e
a coluna pode ficar.

## Open Questions

- Destacar uma palavra do título na capa tipográfica, como a referência faz com a segunda
  linha? Exigiria marcação no título; por ora, título inteiro em uma cor.
- As capas dos cursos produzidos em Remotion podem sair da mesma composição (`renderStill`),
  com o mesmo padrão visual. É decisão da produção, fora do código desta change.
