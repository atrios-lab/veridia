## 1. Núcleo: catálogo e trilha

- [x] 1.1 `src/core/tutorials/catalog.ts`: tipo `Tutorial` (`id`, `title`, `description`,
  `durationSeconds`, `videoUrl`, `captionsUrl`, `route: string | null`, `trail: boolean`) e o
  array `TUTORIALS` na ordem da trilha, inicialmente vazio, com o comentário que explica por que
  o catálogo é código e como um vídeo novo entra (Blob + entrada + PR).
- [x] 1.2 `src/core/tutorials/progress.ts`: `trailProgress(catalog, watchedIds)` (assistidos e
  total, só `trail`), `nextUnwatched(catalog, watchedIds)`, `tutorialForRoute(catalog,
  pathname)` (prefixo mais longo vence, `/admin` só exato), `mediaHosts(catalog)` (hosts únicos
  das URLs de vídeo e legenda), `isTutorialId(catalog, id)`, e a ordenação da lista
  (`listOrder`: trilha primeiro, depois avulsos).
- [x] 1.3 `src/core/tutorials/progress.test.ts` cobrindo os cenários da spec: "2 de 7" com o
  segundo como próximo; avulso não conta; prefixo `/admin/pedidos` cobre `/admin/pedidos/novo`;
  `/admin` não cobre `/admin/usuarios`; hosts sem repetição.
- [x] 1.4 `src/core/tutorials/catalog.test.ts`: ids únicos, toda `route` presente em `ADMIN_NAV`
  ou igual a `/admin`, toda URL https com host em `mediaHosts`, `durationSeconds` positivo.
  Passa com o catálogo vazio e continua valendo para cada vídeo que entrar.

## 2. Banco e leitura do progresso

- [x] 2.1 `src/db/schema.ts`: tabela `tutorialProgress` (`tutorial_progress`): `userId` com
  referência a `user.id` e `onDelete: "cascade"`, `videoId` text, `watchedAt` timestamptz com
  default now, chave primária composta (`user_id`, `video_id`). Comentário: primeira tabela por
  usuário do projeto, sem `tenant_slug`, e por quê (design, decisão 4).
- [x] 2.2 `pnpm db:generate` e revisar a migração gerada (só `CREATE TABLE`).
- [x] 2.3 `src/lib/tutorials.ts` (`server-only`): `listWatchedIds(userId)`,
  `markWatched(userId, videoId)` com `onConflictDoNothing`, `unmarkWatched(userId, videoId)`.
- [x] 2.4 `src/db/tutorials.test.ts` com PGlite: marcar duas vezes mantém o primeiro
  `watched_at`; desmarcar remove; ids de outro usuário não aparecem; apagar o usuário apaga o
  progresso.

## 3. Política de conteúdo

- [x] 3.1 `src/middleware.ts`: `media-src 'self'` mais os hosts de `mediaHosts(TUTORIALS)`,
  cada um como `https://<host>`, sem curinga; comentário no mesmo tom das diretivas vizinhas.
- [x] 3.2 Teste da montagem do CSP (extrair `buildCsp` para módulo testável se ainda não for),
  conferindo que com catálogo vazio a diretiva é só `'self'` e que o host do catálogo aparece
  uma vez.

## 4. Tela de vídeos-aula

- [x] 4.1 `src/app/admin/(dashboard)/ajuda/actions.ts`: `markTutorialWatchedAction(videoId)` e
  `unmarkTutorialWatchedAction(videoId)`, ambas exigindo `getSession()`, validando com
  `isTutorialId` e devolvendo erro em português quando o id não existe; `revalidatePath` de
  `/admin/ajuda` e `/admin`.
- [x] 4.2 `ajuda/_components/tutorial-player.tsx` (client): `<video controls
  preload="metadata">` com `<track kind="captions" srclang="pt-BR" default>`, chamando a action
  de marcar no evento `ended` uma vez por reprodução; botão "Marcar como assistido" / "Desfazer"
  com estado otimista e toast de erro via `sonner`.
- [x] 4.3 `ajuda/_components/tutorial-list.tsx`: lista na ordem de `listOrder`, cada item com
  título, duração formatada ("4 min"), a tela ensinada (rótulo de `ADMIN_NAV` pela rota) e a
  marca de assistido; item atual em destaque.
- [x] 4.4 `ajuda/page.tsx`: `metadata.title = "Vídeos-aula"`, `AdminPageHeader`, resolve
  `?video=` (id inexistente cai no próximo não assistido ou no primeiro), renderiza player e
  lista; estado vazio "Os vídeos-aula estão sendo preparados" sem player quando o catálogo é
  vazio.

## 5. Sidebar, cabeçalho e visão geral

- [x] 5.1 `icon.tsx`: ícone `play` no mesmo estilo de traço único dos demais.
- [x] 5.2 `nav.ts`: item `{ group: "Ajuda", label: "Vídeos-aula", href: "/admin/ajuda", icon:
  "play" }` por último, sem `permission`; `sidebar.tsx` omite o item quando `TUTORIALS` está
  vazio. `nav.test.ts`: "Ajuda" é o último grupo e o item não tem permissão.
- [x] 5.3 `page-header.tsx`: vira `async`, lê `x-pathname` via `headers()`, chama
  `tutorialForRoute` e renderiza o link "Como usar esta tela" (`/admin/ajuda?video=<id>`) ao
  lado do título quando há vídeo; sem header ou sem vídeo, saída idêntica à atual. Rodar
  `pnpm typecheck` para confirmar as 24 chamadas.
- [x] 5.4 `(dashboard)/_components/tutorial-trail-card.tsx`: "Primeiros passos", "N de M
  assistidos", "Próximo: <título>" com link; `(dashboard)/page.tsx` lê `listWatchedIds` do
  usuário da sessão e renderiza o card acima de `KeyboardShortcutsCard` só quando a trilha tem
  vídeo não assistido.

## 6. Conteúdo e fechamento

- [ ] 6.1 Gravar "Primeiros passos" (login, menu, troca de senha) sobre o Homolog com a seed,
  em 1080p e até cinco minutos; produzir a legenda WebVTT; enviar os dois ao Blob pelo painel da
  Vercel; registrar a entrada no catálogo com `trail: true` e `route: null`.
- [ ] 6.2 Aplicar a migração no Homolog (Preview) e em produção pela `POSTGRES_URL_NON_POOLING`
  antes do merge, conforme a rotina de migração manual. Homolog aplicado em 19/09/2026 (pelo
  pooler em modo sessão, porta 5432: o host direto do Supabase é só IPv6). Produção pendente.
- [ ] 6.3 Conferir no navegador, num host de serventia: item na sidebar, vídeo tocando com
  legenda, marca automática ao terminar, "Desfazer", card na visão geral com o andamento e o
  link contextual numa tela coberta pelo catálogo. Sem erro de CSP no console.
- [ ] 6.4 `pnpm typecheck`, `pnpm lint`, `pnpm test`; abrir o PR.
