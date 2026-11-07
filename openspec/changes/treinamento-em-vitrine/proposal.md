## Why

A tela Treinamento (`/admin/ajuda`) é um player com uma lista de texto numerada ao lado:
funciona como playlist, mas não convida a explorar, e um vídeo de aprofundamento se perde no
meio da lista. A biblioteca de vídeos da Numera mostra o caminho: um destaque "Comece por aqui"
no topo e prateleiras de cards com capa logo abaixo. Com a produção dos cursos em andamento, o
catálogo vai crescer, e a tela precisa estar à altura disso antes que a lista fique comprida.

## What Changes

- O topo da tela vira um **destaque** com o player à esquerda e, à direita, um selo de
  andamento, o título, a descrição e a ação de marcar como assistido. O selo muda com o
  progresso da pessoa: "Comece por aqui" quando ela não assistiu nada da trilha, "Continue de
  onde parou · X de Y" quando a trilha está em curso e "Trilha concluída" quando terminou.
- A lista lateral é substituída por **prateleiras** com rolagem lateral: "Primeiros passos"
  (os vídeos da trilha, com o contador "X de Y" no título) e "Aprofundamento" (os demais).
  Uma prateleira vazia não é mostrada.
- Cada vídeo vira um **card** com a capa, a duração no canto da capa, a marca de assistido, a
  categoria em caixa alta (o grupo do menu da tela ensinada, ou "Painel" quando o vídeo não
  ensina uma tela) e o título em até duas linhas. O card do vídeo que está no destaque fica
  marcado como atual.
- Clicar num card continua trocando o `?video=` e tocando o vídeo no destaque, como hoje.
- **Capa opcional por vídeo**: a tabela `tutorials` ganha `poster_path`, e o formulário de
  `/admin/ajuda/gerenciar` ganha um campo opcional de imagem (JPEG, PNG ou WebP), enviado ao
  store pelo mesmo caminho do vídeo. Sem capa, o card mostra uma **capa tipográfica** gerada
  em CSS a partir do título. A capa também vira o `poster` do player.

## Non-goals

- Busca por texto e chips de categoria: o catálogo ainda tem poucos vídeos, e duas prateleiras
  bastam. Ficam para quando o número de vídeos pedir.
- Abrir o vídeo em modal ou numa página própria: o destaque continua sendo o player.
- Gerar a capa automaticamente a partir de um frame do vídeo.
- Mudar o card da trilha na Visão geral ou o link "Como usar esta tela".
- Categoria editável por vídeo: a categoria é derivada da rota ensinada, sem coluna nova.
- Biblioteca de carrossel: a rolagem lateral é CSS (`scroll-snap`) com setas simples.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `admin-tutorials`: o catálogo passa a ter uma capa opcional; a tela troca a lista ao lado do
  player por um destaque com selo de andamento e por prateleiras de cards (trilha e
  aprofundamento) com capa, duração, categoria e marca de assistido.
- `admin-tutorials-management`: "Novo vídeo" e "Editar" aceitam uma imagem de capa opcional,
  com tipo e tamanho limitados pela rota de token; trocar ou remover a capa apaga a anterior do
  store, e excluir o vídeo apaga também a capa.

## Impact

- **Banco**: nova coluna anulável `tutorials.poster_path` (migração Drizzle). A migração de
  produção é manual, via `POSTGRES_URL_NON_POOLING`, antes do merge; o Homolog migra pelo
  pooler.
- **Código**: `src/app/admin/(dashboard)/ajuda/page.tsx` e `_components/` (destaque,
  prateleira, card, capa tipográfica; `tutorial-list.tsx` sai), `src/core/tutorials/`
  (`catalog.ts`, `progress.ts`, `video.ts`), `src/lib/tutorials.ts`, a rota
  `src/app/api/treinamento/upload/route.ts` e o formulário de `/admin/ajuda/gerenciar`.
- **CSP**: nada muda; `img-src` já inclui o host do store.
- **Testes**: `node --test` em `src/core/tutorials/` (`progress.test.ts`, `video.test.ts`) e
  em `src/db/tutorials.test.ts` contra PGlite, para criar, trocar, remover e excluir a capa.
