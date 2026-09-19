## Why

Quem entra no painel hoje aprende a usá-lo por conta própria ou perguntando à Átrios. Cada
serventia nova é um convite, uma senha e um menu de onze telas sem nenhuma explicação; a dúvida
vira ticket de suporte, e o suporte repete a mesma demonstração de tela em cada cartório.
Vídeos curtos, gravados uma vez pela Átrios, resolvem a parte repetida: o operador assiste ao
que ensina a tela em que está, no momento em que tem a dúvida, e a pessoa recém-convidada tem
um caminho de primeiros passos em vez de um menu.

O conteúdo ainda não existe. Esta change entrega o lugar onde ele vai morar e a forma de
publicá-lo, junto com o primeiro vídeo: um módulo sem vídeo é um link para lugar nenhum, e o
painel não oferece isso.

## What Changes

- **Uma tela de vídeos-aula no painel**, em `/admin/ajuda`, aberta a todo usuário autenticado
  sem permissão específica. Lista os vídeos na ordem da trilha, com título, duração, a tela que
  cada um ensina e a marca de assistido. Cada vídeo toca ali mesmo, em player nativo do
  navegador, com legenda.
- **Conteúdo da Átrios, publicado pelo repositório.** A lista de vídeos é um catálogo em
  `src/core`, com id estável, título, descrição, rota ensinada e URLs do arquivo de vídeo e da
  legenda. O arquivo é hospedado no Vercel Blob (que o projeto já usa) e entra no catálogo por
  PR. Não há cadastro nem upload pelo painel: o conteúdo é da plataforma, igual para toda
  serventia, e muda com a cadência de um deploy.
- **Progresso por usuário.** Um vídeo fica marcado como assistido quando chega ao fim ou quando
  a pessoa marca à mão; a marca pode ser desfeita. O progresso é da pessoa, não da serventia, e
  acompanha a conta em qualquer máquina.
- **Trilha de primeiros passos na visão geral.** A visão geral ganha um card ao lado de "Atalhos
  de teclado" com o andamento ("3 de 7 assistidos") e o próximo vídeo não assistido. O card
  some quando a trilha está completa.
- **"Como usar esta tela" nas telas com vídeo.** O cabeçalho de página oferece o link para o
  vídeo daquela rota, quando o catálogo tem um.
- **Item "Vídeos-aula" na sidebar**, num grupo "Ajuda" ao final, visível para todo papel.
  Enquanto o catálogo estiver vazio, o item não é renderizado, pela regra do painel de que link
  sem destino é pior que link ausente.
- **CSP** passa a permitir `media-src` do host do Blob, ao lado do `img-src` que já existe. Nenhum
  player de terceiro entra no painel.
- **BREAKING**: nenhuma. Uma tabela nova, sem alteração das existentes.

## Capabilities

### New Capabilities
- `admin-tutorials`: o catálogo de vídeos-aula da plataforma, a tela que os exibe e toca, o
  progresso por usuário, a trilha de primeiros passos e o link contextual por tela.

### Modified Capabilities
- `admin-shell`: a navegação ganha o grupo "Ajuda" com o item "Vídeos-aula", sem permissão,
  omitido enquanto o catálogo está vazio; o cabeçalho de página ganha o link "Como usar esta
  tela" quando a rota tem vídeo.
- `admin-overview`: a visão geral ganha o card da trilha de primeiros passos, com andamento e
  próximo vídeo, ausente quando a trilha está completa.

## Impact

- `src/core/tutorials/`: catálogo (`catalog.ts`) com o tipo do vídeo e a lista, e as funções
  puras de trilha (`progress.ts`: próximo não assistido, contagem, vídeo de uma rota), com
  testes.
- `src/db/schema.ts` + migração: tabela `tutorial_progress` (`user_id`, `video_id`,
  `watched_at`), chave composta, sem `tenant_slug`. É a primeira tabela por usuário do projeto;
  o design registra o porquê.
- `src/lib/tutorials.ts`: leitura e gravação do progresso do usuário da sessão.
- `src/app/admin/(dashboard)/ajuda/`: `page.tsx`, `actions.ts` (marcar e desmarcar),
  `_components/` (lista, player com `<video>` e `<track>`, botão de assistido).
- `src/app/admin/_components/nav.ts` e `sidebar.tsx`: grupo "Ajuda", item condicionado ao
  catálogo não vazio; `page-header.tsx`: link contextual opcional.
- `src/app/admin/(dashboard)/page.tsx` + `_components/tutorial-trail-card.tsx`: card da trilha.
- `src/middleware.ts`: `media-src` com o host do Blob.
- Conteúdo: o primeiro vídeo (primeiros passos: login, menu, troca de senha) gravado sobre o
  Homolog, com legenda WebVTT, enviado ao Blob e registrado no catálogo no mesmo PR.
- Specs: nova `admin-tutorials`; deltas em `admin-shell` e `admin-overview`.
- Sem dependência nova. Sem alteração no site público.

## Non-Goals

- Cadastro, edição ou upload de vídeos pelo painel, por superadmin ou por serventia. O catálogo
  é código; se a cadência de conteúdo um dia exigir publicar sem deploy, é outra change, com a
  lista atual virando seed.
- Vídeos da própria serventia (procedimentos internos). O módulo é da plataforma.
- Streaming adaptativo, transcodificação ou provedor de vídeo (YouTube, Vimeo, Mux). Um MP4 por
  vídeo, curto, servido pelo Blob.
- Obrigatoriedade: ninguém é impedido de usar o painel por não ter assistido nada. A trilha é
  sugestão, não gate.
- Relatório para a Átrios de quem assistiu o quê. A tabela guarda o dado; a leitura agregada
  fica para quando houver pergunta concreta.
- Busca de vídeos na busca global.
- Vídeos no site público ou para o cidadão.
