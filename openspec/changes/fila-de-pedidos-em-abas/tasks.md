## 1. Dados e ordem da fila

- [x] 1.1 ~~`src/core/tenant/schema.ts`~~ Feito em `src/core/acts/catalog.ts` como
      `ATTRIBUTION_ACRONYMS`, ao lado de `ATTRIBUTION_SHORT_NAMES` (que já existia, com os
      nomes curtos por extenso); a cópia local de `pedidos/page.tsx` sai na tarefa 4.6.
- [x] 1.2 `src/lib/service-request.ts`: `listServiceRequests` passa a aceitar
      `{ statuses?, attribution?, search?, limit?, offset? }` (`inArray` para `statuses`,
      remover `status` simples); ordem `createdAt desc` mantida.
- [x] 1.3 `src/lib/service-request.ts`: criar `countServiceRequests(tenantSlug, { statuses?,
      attribution?, search? })` com os mesmos filtros de 1.2.
- [x] 1.4 `src/lib/service-request.ts`: criar `countByStatus(tenantSlug)` com `GROUP BY status`
      restrito a `kind = "service-request"`, devolvendo `Record<string, number>`.
- [x] 1.5 `src/app/admin/(dashboard)/pedidos/_components/queue-order.ts`: substituir
      `QUEUE_GROUPS`/`queueGroupOf` por `QUEUE_TABS` (id, rótulo, tom, statuses; oito abas na
      ordem do design.md; `payment-reported` com aba própria, confirmada pelo produto em
      2026-09-11 sob a condição de caberem numa linha (ver 5.8)), `queueTabOf(status)`, `isQueueTabId`, e remover o campo `group` de
      `compareQueueRows` (o comparador da aba Finalizados vira "mais novo primeiro" sem agrupar
      por andamento).
- [x] 1.6 `queue-order.ts`: criar as funções puras `queueSearchParams(raw)` (normaliza `aba`,
      `atribuicao`, `q`, `pagina`, `por` conforme design.md, incluindo página além da última),
      `queueHref(current, patch)` (zera `pagina` quando o patch toca aba, atribuição, busca ou
      tamanho) e `pageSlice(rows, page, size)`.
- [x] 1.7 `queue-order.test.ts`: trocar os testes de bandas por testes de `queueTabOf`, da
      ordem dentro de uma aba em aberto, da ordem em Finalizados, de `queueSearchParams`
      (aba desconhecida, `por` inválido, página além da última), de `queueHref` e de
      `pageSlice`. Rodar `pnpm test`.
- [x] 1.8 `status-tone.ts`: remover `BAND_STYLES`/`bandClass` (sem uso após 1.5) e ajustar
      `status-tone.test.ts` se cobrir a banda.

## 2. Componentes de UI compartilhados

- [x] 2.1 `src/app/globals.css`: adicionar em `@theme` os tokens `--color-admin-footer-bg`
      (`#fbfaf7`) e `--color-admin-focus-ring` (`#b7cdbd`), e a classe `.checkbox-admin`
      (`appearance: none`, 16px, raio 4, borda `admin-faint`, hover `admin-success-text`,
      marcado com fundo/borda `admin-primary` e check por pseudo-elemento, anel de foco).
      Rodar `pnpm check:tokens`.
- [x] 2.2 `src/app/admin/_components/icon.tsx`: adicionar `trash`. Os chevrons de paginação não
      foram adicionados: o protótipo usa os glifos « ‹ › » em texto, não ícones.
- [x] 2.3 `src/app/admin/_components/checkbox.tsx`: componente `Checkbox` sobre
      `<input type="checkbox" className="checkbox-admin">`, com `aria-label` obrigatório.
- [x] 2.4 `src/app/admin/_components/dropdown.tsx` (client): `Dropdown` com gatilho
      (`aria-haspopup="menu"`, `aria-expanded`, borda que muda em hover/aberto), menu
      `role="menu"` posicionado abaixo, opções `<Link role="menuitemradio" aria-checked>` com
      check na ativa; fecha com Escape, clique fora e ao escolher; setas movem o foco.

## 3. Barra do topo e bloco de título

- [x] 3.1 `src/app/admin/_components/user-menu.tsx` (client): avatar com `initials()`, nome,
      chevron; menu com o cargo (`ROLE_LABELS`) e `<form action={signOut}><SignOutButton /></form>`;
      Escape e clique fora fecham; `aria-expanded` no gatilho.
- [x] 3.2 `src/app/admin/_components/top-bar.tsx` (server): botão de menu mobile
      (`popovertarget={ADMIN_MENU_ID}`, `md:hidden`), `SearchTriggerButton` com
      `max-w-[460px]`, chip do chat (mover a lógica de `readChatAvailability`/`isChatOpen` de
      `page-header.tsx`) e `UserMenu`. Mover a constante `ADMIN_MENU_ID` para cá.
- [x] 3.3 `src/app/admin/_components/global-search.tsx`: placeholder do
      `SearchTriggerButton` vira "Buscar no painel"; conferir que o overlay mantém o texto
      longo no input dele.
- [x] 3.4 `src/app/admin/_components/page-header.tsx`: reescrever `AdminPageHeader` como bloco
      de título dentro do conteúdo (h1 26px serif, `back` opcional antes do título,
      `description` opcional, `actions` opcional à direita), sem buscar dados e sem o botão
      de menu. Manter os nomes `title` e `back`.
- [x] 3.5 `src/app/admin/_components/sidebar.tsx`: remover o rodapé de usuário e a prop `user`;
      manter `initials()` exportada. Ajustar `locked-sidebar.tsx` se importar algo removido.
- [x] 3.6 `src/app/admin/(dashboard)/layout.tsx`: renderizar `<AdminTopBar user={…} />` acima
      de `{children}` (dentro da coluna que rola) e parar de passar `user` para as duas cópias
      da sidebar; atualizar o import de `ADMIN_MENU_ID`.
- [x] 3.7 `src/app/admin/(dashboard)/_components/overview-header.tsx`: remover busca e data,
      manter saudação e contagem da mesa no formato do bloco de título.
- [x] 3.8 `pnpm typecheck` ok (nenhum call site precisou de edição). Conferidas no navegador a
      Visão geral, a fila e `/admin/agenda/configuracao` (uma das três com `back`): título 26px
      serif com 30px acima e o `py-7` do `main` abaixo, sem sobreposição com a barra do topo.

## 4. Tela da fila

- [x] 4.1 `pedidos/_components/queue-tabs.tsx`: abas como `<Link scroll={false}>` a partir de
      `QUEUE_TABS` e dos contadores, com `aria-current` na ativa, contador no tom da aba quando
      ativa e neutro quando inativa, `flex-wrap`.
- [x] 4.2 `pedidos/_components/queue-toolbar.tsx`: "Exibir [10 ▾] por página" com `Dropdown`
      (10/25/50), `Dropdown` de atribuição ("Atribuição: todas" + siglas de
      `tenant.attributions`), form GET de busca com lupa, hidden inputs de `aba`, `atribuicao`
      e `por`, e link "Limpar" quando há filtro ou busca.
- [x] 4.3 `pedidos/_components/queue-pagination.tsx`: rodapé "Exibindo X a Y de Z pedido(s)" /
      "Nenhum registro" e botões « ‹ [páginas] › » como `<Link scroll={false}>`, ativo em
      `admin-primary`, setas desabilitadas em `admin-input-border`, janela com reticências
      acima de sete páginas.
- [x] 4.4 `pedidos/_components/deadline-badge.tsx`: prop `showRunning?: boolean` (padrão
      false) que, quando true e a urgência é `running`, renderiza "Vence em dd/mm" em texto
      simples; quando o pedido está em `ready-for-pickup` renderizar "—". Adicionar os textos
      novos ao teste do badge, se houver, ou cobrir em `deadline.test.ts`.
- [x] 4.5 `pedidos/_components/queue-rows.tsx`: reescrever com o grid novo (variante por aba:
      Prazo nas abas em aberto, Situação em Finalizados), `Checkbox` por linha e no cabeçalho
      (marca a página atual), barra de seleção ("N protocolo(s) selecionado(s)", "Desmarcar",
      botão "Arquivar" com ícone `trash` e visual destrutivo, via `ConfirmAction` com a
      confirmação atual), limpar a seleção após sucesso da ação, botão "Detalhar" por linha,
      linha sem link, `opacity-85` em Finalizados, estado vazio com os dois textos do design,
      container `overflow-x-auto` com `min-w-[900px]`.
- [x] 4.6 `pedidos/page.tsx`: reescrever com `queueSearchParams`, `countByStatus` (somado por
      aba), caminho de Finalizados (SQL com `limit`/`offset` + `countServiceRequests`) e caminho
      das abas em aberto (tudo da aba, `compareQueueRows`, `pageSlice`); compor
      `AdminPageHeader` (título, subtítulo "Acompanhe e dê andamento aos pedidos feitos pelo
      site ou no balcão.", ação "Lançar pedido" com ícone `plus`), `QueueTabs`,
      `QueueToolbar`, `QueueRows` e `QueuePagination` dentro do card.
- [x] 4.7 `pedidos/loading.tsx`: esqueleto com bloco de título, card, abas sem contador e dez
      linhas de 49px em `animate-pulse`.
- [x] 4.8 `pnpm lint`, `pnpm typecheck`, `pnpm check:tokens`, `pnpm test` (550/550) ok.
      `pnpm check:a11y` reprova com 13 violações de contraste, todas pré-existentes e fora
      desta change: rodapé das rotas públicas e `.text-admin-on-dark-muted` no login do tenant
      oliva-terracota (bentofernandes); a varredura não cobre `/admin/pedidos`.

## 5. E2E e conferência visual

- [x] 5.1 `e2e/admin-service-requests.spec.ts`: a linha deixa de ser link (localizar a linha
      pelo protocolo e clicar em "Detalhar"); "Pagamento informado" passa a ser conferido pela
      aba (`?aba=payment-reported`) em vez do selo na linha; "Em processamento" idem
      (`?aba=processing`); cobrir contador da aba, filtro por atribuição, busca e paginação
      com um cenário simples.
- [x] 5.2 `e2e/admin-login.spec.ts` e demais que clicam em "Sair": abrir o menu do usuário
      antes de acionar o botão.
- [x] 5.3 `e2e/admin-global-search.spec.ts`: nada a ajustar. O teste abre a busca por Ctrl K e
      usa o placeholder do overlay, que não mudou; o gatilho da barra nunca foi selecionado.
- [x] 5.4 Rodados `admin-service-requests`, `admin-login`, `admin-global-search`,
      `admin-support-chat` e `admin-sidebar`: tudo verde, exceto dois testes do detalhe do
      pedido ("a registered requirement appears right away" e "uma exigência cadastrada suspende
      o prazo…") que falham igual numa worktree limpa de `main` (o texto da exigência não aparece
      em 5s depois de "Registrar"): pré-existente, fora desta change. O e2e completo fica para o
      CI.
- [x] 5.5 Conferir no navegador, com o protótipo aberto ao lado a 1440px: abas e contadores,
      dropdowns (teclado e clique fora), busca com Enter, "Limpar", seleção e arquivamento em
      lote com a seleção limpa depois, paginação, aba Finalizados com Situação, estado vazio,
      loading, barra do topo em duas telas além da fila (Visão geral e uma com `back`), e a
      fila em 375px (rolagem horizontal, botão de menu).
- [x] 5.6 `openspec validate fila-de-pedidos-em-abas --strict`: válido.
- [x] 5.7 Bug achado na conferência do usuário (2026-09-11): com a tabela mais alta que a
      coluna, a página inteira rolava e a casca subia, deixando branco embaixo. Causa: os `sr-only`
      das setas da paginação são `position:absolute` e, sem ancestral posicionado, esticavam o
      documento. Corrigido com `relative` na coluna de rolagem do layout e na nav da sidebar
      (mesmo padrão); reconferido a 760px de altura, documento fica em 100vh.
- [x] 5.8 Abas quebravam em duas linhas com a oitava ("Pagamento informado"). O produto manteve a
      aba e pediu uma linha só: `queue-tabs.tsx` passa a 13px, 6px de padding lateral e 4px
      até o contador, sem `flex-wrap`, com `overflow-x-auto` como rede de segurança;
      `loading.tsx` acompanha. Medido em headless: a 1440px as oito cabem com 33px de folga; a
      1366px faltam 41px e a linha rola de lado (sem quebrar).
- [x] 5.9 Pedido do produto depois do 5.8: aproveitar a largura e não rolar. As abas passam a
      dividir a linha em partes iguais (`flex-1`, rótulo centralizado) e uma container query
      (`@max-[1120px]` no card) desce para 12.5px e 4px de padding quando a linha fica estreita.
      Medido: cabe a 1366px e a 1440px; só a 1280px ainda rola 65px de lado.
- [x] 5.10 Pedido do produto: sumir com a barra de rolagem vertical na borda direita do conteúdo
      (a coluna rola por dentro da casca; com mouse conectado o macOS pinta a barra sempre).
      Classe `.scrollbar-hidden` em `globals.css` aplicada à coluna no layout; roda, trackpad e
      teclado continuam rolando (verificado: `scrollTop` avança com a roda, gutter 0).
- [x] 5.11 Pedido do produto: aba não pode rolar de lado. Sai o `overflow-x-auto`; as quatro abas
      de rótulo longo ganham forma curta ("Exigência", "Aguard. pagamento", "Pgto. informado",
      "P/ retirada") mostrada por container query abaixo de 1120px de card, o que deixa folga
      real (907px de conteúdo). Abaixo de 1210px de viewport (tablet, celular) a linha volta a
      quebrar, porque cortar uma aba é pior que uma segunda linha. Medido: 1280 a 1970px numa
      linha sem rolagem; 1100px em duas linhas.
