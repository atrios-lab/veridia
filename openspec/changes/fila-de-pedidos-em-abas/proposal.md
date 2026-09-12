## Why

A fila de `/admin/pedidos` lista todos os protocolos da serventia numa única página, em bandas
coloridas por prioridade. Funciona com dezenas de pedidos; com centenas vira uma rolagem sem fim
em que o operador passa pelos encerrados para achar o que precisa de mão, e o filtro por
andamento (um `<select>` com onze opções) é a única forma de encurtar a lista. O redesign
entregue em `Redesign 22 - Fila de Pedidos em Abas.dc.html` (handoff em `README copy.md`)
troca as bandas por abas com contador, uma por andamento, e acrescenta paginação, busca e
filtro por atribuição dentro de cada aba, de modo que a tela mostre de uma vez só o que o
operador escolheu olhar.

## What Changes

- **Abas em vez de bandas.** A fila passa a ter uma aba por andamento em aberto (Novo,
  Aguardando exigência, Aguardando pagamento, Pagamento informado, Pago, Em andamento,
  Disponível para retirada) mais uma aba **Finalizados** que agrupa Concluído, Indeferido,
  Cancelado e Arquivado. Cada aba mostra a quantidade de protocolos. A aba ativa vem da URL
  (`?aba=`), com Novo como padrão. As abas ficam sempre numa linha só.
  - O handoff lista sete abas e não cita "Pagamento informado", que ficou fora do vocabulário
    que o designer recebeu. O andamento existe e foi mantido de propósito em
    `enxugar-status-pedido` (tem e-mail, comprovante e regra própria), então ganha aba própria,
    no mesmo tom âmbar de "Aguardando pagamento". A condição, dada pelo produto em 2026-09-11,
    é que as oito caibam na mesma linha: a aba fica um pouco mais justa que a do protótipo
    (13px e 6px de padding lateral em vez de 13.5px e 11px).
- **Colunas enxutas.** A coluna de andamento sai (a aba já diz o andamento), assim como as de
  valor e contato. Na aba Finalizados entra a coluna **Situação** (Concluído, Indeferido,
  Cancelado, Arquivado). O prazo ganha coluna própria nas abas em aberto, com a mesma lógica de
  urgência de hoje e, fora da janela de urgência, a data prevista em texto simples.
- **Paginação.** 10, 25 ou 50 por página (`?por=`, `?pagina=`), com rodapé "Exibindo X a Y de Z
  pedidos" e botões de página. Trocar aba, filtro, busca ou tamanho de página volta à página 1.
- **Filtro por atribuição e busca** continuam server-side, agora como dropdown customizado e
  campo com lupa, com link "Limpar" quando há filtro ativo. O filtro por andamento some: a aba
  cumpre esse papel.
- **Ordem dentro da aba** mantém `compareQueueRows` (vencido primeiro, depois vence em breve,
  depois pausado há mais tempo, depois chegada mais antiga). Em Finalizados: mais recente
  primeiro, sem agrupar por andamento (a coluna Situação já distingue).
- **Seleção em massa** com checkbox por linha, checkbox de cabeçalho que marca a página atual e
  barra de ações. A ação continua sendo **arquivar** (`deactivateServiceRequestsAction`, que
  grava `archived`), com a confirmação de hoje. O protótipo rotula o botão como "Apagar" com
  ícone de lixeira; o rótulo fica **"Arquivar"**, porque nada é apagado e a spec já trata
  exclusão de protocolo como exceção com confirmação própria no detalhe. O visual destrutivo
  (fundo e borda vermelhos) do protótipo é mantido.
- **Linha deixa de ser link.** O detalhe abre pelo botão "Detalhar" na coluna Ações, para o
  checkbox não disputar o clique com a navegação.
- **Header do painel reformulado**, para todas as telas: a busca global (Ctrl K), o chip do chat
  e o bloco do usuário (avatar, nome, menu com cargo e "Sair") passam a viver numa barra única
  renderizada pelo layout. Título da tela e data saem do header; o título vira um bloco no
  próprio conteúdo da página, com subtítulo e ações opcionais. O rodapé de usuário da sidebar
  sai. O botão de menu mobile continua no header, só abaixo de `md`.
  - O sino de notificações do protótipo **não** é renderizado: não há fonte de dados, e a spec da
    casca já registra que controle que não leva a lugar nenhum é pior que controle ausente. A
    mesma regra vale para "Trocar senha" no menu do usuário: continua sem tela dentro do painel.
- **Estado de carregamento** com esqueleto de dez linhas (`loading.tsx`).

## Capabilities

### New Capabilities
(nenhuma)

### Modified Capabilities
- `admin-service-requests`: o requisito "Fila de pedidos filtrável e pesquisável" troca bandas
  por abas com contador, paginação e colunas novas; o detalhe passa a abrir pelo botão
  "Detalhar" em vez da linha inteira. O requisito "Urgência do prazo na fila e no detalhe do
  pedido" passa a mostrar, na fila, a data prevista em texto quando não há urgência (o detalhe
  não muda). A ação em massa de arquivar (de `bulk-protocol-inactivation`) passa a agir sobre a
  página atual, com barra de seleção própria.
- `admin-shell`: o requisito "Cabeçalho da tela e rodapé de usuário" muda: o header passa a
  reunir busca global, chip do chat e menu do usuário (com "Sair"); título vai para o conteúdo
  da tela; data e rodapé de usuário da sidebar saem.

## Impact

- `src/lib/service-request.ts`: `listServiceRequests` aceita `statuses: string[]`, `limit`,
  `offset` e ordem; novas `countServiceRequests` (mesmos filtros) e `countByStatus(tenant)`
  (`GROUP BY status`) para os contadores das abas. `openRequestCount` segue como está.
- `src/app/admin/(dashboard)/pedidos/`: `page.tsx` reescrito (abas, paginação, novos
  searchParams `aba`, `atribuicao`, `q`, `pagina`, `por`); `_components/queue-rows.tsx`
  reescrito (grid novo, seleção por página, botão Detalhar); `queue-order.ts` perde as bandas e
  ganha a tabela de abas; novos `queue-tabs.tsx`, `queue-toolbar.tsx`, `queue-pagination.tsx`,
  `loading.tsx`; `deadline-badge.tsx` ganha a variante "Vence em dd/mm" e o traço para
  Disponível para retirada.
- `src/app/admin/_components/`: novo `top-bar.tsx` (busca, chat, usuário) e `user-menu.tsx`;
  `page-header.tsx` vira o bloco de título dentro do conteúdo (mesma API, `description` e
  `actions` novos); `sidebar.tsx` perde o rodapé; `dropdown.tsx` e `checkbox.tsx` novos;
  `icon.tsx` ganha `trash`, `chevronLeft`/`chevronRight` (paginação) e `chevronsLeft`/
  `chevronsRight`.
- `src/app/admin/(dashboard)/layout.tsx`: renderiza a barra do topo. As 22 telas que chamam
  `AdminPageHeader` continuam funcionando sem edição; `overview-header.tsx` perde busca e data
  (agora na barra do topo).
- Tokens: `src/app/globals.css` ganha `--color-admin-footer-bg` (`#fbfaf7`) e
  `--color-admin-focus-ring` (`#b7cdbd`); os demais hex do handoff já têm token.
- Testes: `queue-order.test.ts` (abas em vez de bandas), teste novo da paginação em memória,
  e2e `admin-service-requests.spec.ts` (linha não é mais link; "Pagamento informado" é aba, não
  selo), `admin-login.spec.ts` (o "Sair" agora está dentro do menu do usuário) e
  `admin-global-search.spec.ts` (placeholder da busca vira "Buscar no painel").
- Nenhuma mudança de banco nem de andamento: os onze valores de `SERVICE_REQUEST_STATUSES`
  ficam como estão.

## Non-Goals

- Não muda o vocabulário de andamentos nem cria migração de dados: `enxugar-status-pedido` já
  fez esse trabalho e esta change parte dos onze valores atuais.
- Não renderiza sino de notificações nem "Trocar senha": ambos entram quando tiverem tela ou
  fonte de dados por trás.
- Não transforma "Arquivar" em exclusão real; exclusão continua no detalhe, uma por vez.
- Não toca nas outras filas (LGPD, ouvidoria, agenda), que continuam com o layout de hoje; só
  herdam a barra do topo nova, como toda tela do painel.
- Não muda o detalhe do pedido nem o contador da sidebar.
- Não cria layout de cartões para telas estreitas: abaixo de `md` a tabela rola na horizontal.
- Não introduz Radix/shadcn: dropdown e checkbox são componentes próprios, pequenos.
