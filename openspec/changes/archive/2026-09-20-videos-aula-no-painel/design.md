## Context

O painel não tem hoje nenhum conteúdo de ajuda além do card "Atalhos de teclado" da visão
geral (`keyboard-shortcuts-card.tsx`, uma lista fixa em código). Todo módulo existente é
conteúdo da serventia: tabela com `tenantSlug`, CRUD pelo cartório, permissão `content.edit`.
Vídeo de treinamento é o primeiro conteúdo da plataforma dentro do painel: igual para toda serventia,
produzido pela Átrios, lido pelo cartório.

Peças que a change reaproveita:

- A sidebar é dados (`ADMIN_NAV` em `nav.ts`), agrupada por `group`, filtrada por permissão em
  `sidebar.tsx`. `navGroups` fecha um grupo quando o próximo item nomeia outro.
- `AdminPageHeader` (`page-header.tsx`) é um server component com `title`, `back`,
  `description` e `actions`, chamado por 24 telas, nenhuma delas cliente. O middleware já grava
  a rota em `x-pathname`, que o layout do dashboard lê com `headers()`.
- A visão geral (`(dashboard)/page.tsx`) tem uma coluna direita de cards; o último é o de
  atalhos.
- O CSP (`src/middleware.ts`) é `default-src 'self'` com hosts exatos por diretiva; `img-src` e
  `connect-src` já recebem `BLOB_PUBLIC_HOST` quando definido. Não há `media-src`, então um
  `<video>` apontando para o Blob é bloqueado hoje.
- `getSession()` (`src/lib/session.ts`) já garante que a sessão pertence à serventia do host.
  O `user.id` que ela devolve é a identidade que o progresso precisa.
- Testes rodam com `node --test` e PGlite em processo; as funções puras de `src/core` são o
  que se testa de verdade.

## Goals / Non-Goals

**Goals:**
- O operador assiste, dentro do painel, ao vídeo que ensina a tela em que está.
- Uma pessoa recém-convidada encontra a trilha de primeiros passos sem procurar.
- Publicar um vídeo novo é: subir o MP4 e a legenda, acrescentar uma entrada no catálogo, abrir
  PR. Nada de tela nova para a Átrios.
- Nenhum terceiro (player, cookie, script) entra no painel.
- O progresso acompanha a conta, em qualquer máquina.

**Non-Goals:**
- Cadastro ou upload pelo painel; vídeos da própria serventia.
- Streaming adaptativo ou provedor de vídeo.
- Trilha obrigatória; relatório de quem assistiu.

## Decisions

### 1. O catálogo é código em `src/core/tutorials/catalog.ts`

Um array tipado `TUTORIALS`, na ordem da trilha, com `id` (slug estável, chave do progresso),
`title`, `description`, `route` (a rota do painel que o vídeo ensina, ou `null` para
primeiros passos), `durationSeconds`, `videoUrl`, `captionsUrl` e `trail: boolean`. Ao lado,
`progress.ts` com as funções puras: `nextUnwatched(catalog, watchedIds)`,
`trailProgress(catalog, watchedIds)` (assistidos e total, só dos vídeos com `trail`),
`tutorialForRoute(catalog, pathname)`, `mediaHosts(catalog)`.

Alternativa: tabela `tutorials` editada por superadmin. Descartada. Seria a primeira tabela
sem `tenantSlug` editável e a primeira tela "de plataforma" do painel (hoje o superadmin só
entra numa serventia). O conteúdo é da Átrios, muda com a cadência de um deploy e passa por
revisão em PR como qualquer texto do painel. Quando a lista for grande o bastante para doer,
ela vira seed da tabela: o tipo já é o da linha.

Alternativa: arquivo JSON ou Markdown. Descartada: TypeScript dá o tipo de graça e o teste
que confere ids únicos, rotas existentes e URLs no host permitido.

### 2. MP4 no Vercel Blob, tocado por `<video>` nativo

Cada vídeo é um arquivo H.264 1080p, curto, com legenda WebVTT ao lado, os dois enviados ao
Blob pelo painel da Vercel (não pelo aplicativo). O catálogo guarda as URLs completas. O player
é `<video controls preload="metadata">` com `<track kind="captions" srclang="pt-BR">`.

Alternativa: YouTube não listado em `<iframe>`. Descartada: abre `frame-src` para o Google num
painel de cartório, com cookie, telemetria e vídeos relacionados; o link "não listado" é
público de qualquer forma; e a adequação à LGPD que o próprio painel conduz desaconselha.

Alternativa: Cloudflare R2 (grátis nessa escala, sem custo de saída). Descartada por ora: o
Blob já está no stack, com host no CSP e `next/image`, e o custo de um ou dois GB assistidos
por poucas dezenas de pessoas fica abaixo do mensurável. Se a conta do Blob um dia pesar,
trocar o host das URLs no catálogo é a migração inteira.

Alternativa: upload pelo aplicativo (`src/lib/uploads.ts`). Descartada: o limite de anexo é 20
MB e o caminho é do cidadão; um vídeo é pesado e sobe uma vez por quem já tem acesso à Vercel.

### 3. `media-src` derivado do catálogo, não de variável de ambiente

O middleware acrescenta `media-src 'self'` mais os hosts de `mediaHosts(TUTORIALS)`. O
catálogo é o mesmo em todo ambiente, então o host do vídeo é o mesmo em desenvolvimento,
Preview e produção, ainda que `BLOB_PUBLIC_HOST` (o store da serventia) varie ou esteja vazio.
Continua sendo host exato, nunca curinga. Com catálogo vazio a diretiva fica só `'self'`.

Alternativa: reaproveitar `BLOB_PUBLIC_HOST`. Descartada: em desenvolvimento ele costuma
estar vazio e o vídeo não tocaria; e um store de tutoriais da plataforma não precisa ser o
mesmo store dos uploads da serventia.

### 4. Progresso em tabela por usuário, sem `tenant_slug`

`tutorial_progress (user_id text → user.id on delete cascade, video_id text, watched_at
timestamptz)`, chave primária composta. `video_id` é o slug do catálogo, sem chave
estrangeira (o catálogo não é tabela). Uma entrada removida do catálogo deixa linhas órfãs
inofensivas; nenhuma migração acompanha troca de conteúdo.

Sem `tenant_slug` de propósito: o progresso é da pessoa. Um usuário pertence a uma serventia
só, então filtrar por `user_id` já é filtrar pela serventia dele; e a leitura só acontece com
o `user.id` de `getSession()`, que já recusou sessão de outra serventia. O comentário na tabela
registra que esta é a primeira tabela por usuário do projeto e por quê.

Alternativa: `localStorage`. Descartada: balcão compartilha máquina e a pessoa troca de
computador; o progresso sumiria ou apareceria para a pessoa errada.

Alternativa: coluna JSON em `user`. Descartada: `user` é tabela do Better Auth e a lista
cresceria sem limite dentro de um campo.

### 5. Marcar ao terminar, e à mão, por server action idempotente

`markTutorialWatched(videoId)` e `unmarkTutorialWatched(videoId)` em `ajuda/actions.ts`,
ambas validando o `videoId` contra o catálogo e usando o `user.id` da sessão. O player
(client component) chama a primeira no evento `ended`; o botão "Marcar como assistido" /
"Desfazer" chama uma ou outra. Gravar de novo um vídeo já assistido não altera `watched_at`
(`on conflict do nothing`), para "assistido em" ser a primeira vez.

Sem auditoria: `audit_log` registra ações sobre a serventia; assistir a um vídeo não é uma.

### 6. Trilha é a ordem do catálogo filtrada por `trail`

A visão geral chama `trailProgress` e `nextUnwatched` com os ids assistidos do usuário e
renderiza `TutorialTrailCard` com "N de M assistidos" e o link para o próximo. Sem
`trail: true` restante, o card não renderiza. Vídeos de tela avulsos (por exemplo um
aprofundamento de Adequação) entram com `trail: false` e ficam só na lista e no link
contextual: a trilha não cresce a cada vídeo novo.

### 7. Link contextual lido de `x-pathname` no cabeçalho

`AdminPageHeader` vira `async`, lê `x-pathname` com `headers()` e, se `tutorialForRoute`
encontrar um vídeo, renderiza "Como usar esta tela" ao lado do título, apontando para
`/admin/ajuda?video=<id>`. Nenhuma das 24 telas muda; nenhuma delas é client component.
`tutorialForRoute` casa pelo prefixo da rota do catálogo (`/admin/pedidos` cobre
`/admin/pedidos/novo` e o detalhe), com o mais longo vencendo; `/admin` só casa exato.

Alternativa: cada tela passar `tutorial="pedidos"` ao cabeçalho. Descartada: 24 edições e um
lugar a mais para esquecer quando um vídeo novo entra.

### 8. Item de menu só com catálogo não vazio

`ADMIN_NAV` ganha `{ group: "Ajuda", label: "Treinamento", href: "/admin/ajuda", icon:
"play" }` no fim, sem `permission`. `sidebar.tsx` omite o item quando `TUTORIALS` está vazio,
pela mesma regra que já omite rota sem permissão. A rota `/admin/ajuda` existe de qualquer
forma e, vazia, mostra o estado "Os vídeos estão sendo preparados". O ícone `play` é novo em
`icon.tsx`.

### 9. Player e página

`/admin/ajuda?video=<id>` abre o vídeo pedido no topo (ou o próximo não assistido, ou o
primeiro) e lista os demais abaixo, com título, duração, tela ensinada e marca de assistido. A
lista é a trilha primeiro, depois os avulsos. Um `video` inexistente cai no comportamento sem
parâmetro, sem 404.

## Risks / Trade-offs

- [Um MP4 só, sem qualidade adaptativa] → vídeos curtos (até cinco minutos), 1080p a taxa
  moderada, `preload="metadata"`. O painel é usado dentro do cartório, não em 3G.
- [Custo de banda do Blob cresce com o acervo e o uso] → acervo de um ou dois GB e público de
  dezenas de pessoas; conferir no painel da Vercel após o primeiro mês. Trocar o host no
  catálogo migra tudo.
- [Vídeo gravado com dado real de cidadão] → gravação sobre o Homolog com a seed, e a revisão
  do PR que registra o vídeo confere a tela.
- [Catálogo aponta para URL que não existe mais] → o teste do catálogo não alcança a rede; a
  página mostra o erro nativo do `<video>`. Aceito: quem remove um arquivo do Blob é quem edita
  o catálogo.
- [Linhas órfãs em `tutorial_progress` quando um vídeo sai do catálogo] → inofensivas; a
  contagem da trilha só olha ids do catálogo.
- [`AdminPageHeader` passa a ser assíncrono] → RSC aceita em todas as 24 telas (nenhuma é
  cliente); `typecheck` pega qualquer chamada que não aceite.
- [`x-pathname` ausente fora do middleware] → sem o header, nenhum link contextual; a página
  continua inteira.

## Migration Plan

1. Migração `tutorial_progress` (só expande: tabela nova). Aplicar no Homolog pelo Preview e em
   produção manualmente antes do merge, como toda migração.
2. Enviar o primeiro MP4 e a legenda ao Blob; registrar no catálogo no mesmo PR do módulo.
3. Deploy. Rollback é reverter o PR; a tabela pode ficar.

## Open Questions

- Um store do Blob separado para tutoriais ou o mesmo das serventias? O catálogo aceita
  qualquer um; a decisão é de quem sobe o primeiro arquivo.
- O primeiro vídeo cobre só "Primeiros passos" ou já entra com "Pedidos de serviço"? O módulo
  entra com pelo menos um; os demais são conteúdo, não código.
