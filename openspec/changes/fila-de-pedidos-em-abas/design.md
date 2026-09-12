## Context

A fila de `/admin/pedidos` é um server component que lê `andamento`, `atribuicao` e `q` de
`searchParams`, chama `listServiceRequests` (que devolve **tudo** que casa, do mais novo ao mais
antigo), calcula prazo e urgência por linha em memória (`effectiveDeadline` + `deadlineUrgency`,
a partir de `details.deadline`, do prazo legal do ato e do prazo padrão do tenant), ordena com
`compareQueueRows` e entrega as linhas a `QueueRows`, um client component que cuida da seleção
e da ação em massa de arquivar. As bandas (`QUEUE_GROUPS`) e o tom de cada andamento
(`STATUS_TONES`) vivem em `queue-order.ts` e `status-tone.ts`.

O header (`AdminPageHeader`) é chamado por 22 telas com `title` e, em três delas, `back`. Ele
busca sozinho a disponibilidade do chat e renderiza o botão do menu mobile (`popovertarget`). A
Visão geral tem header próprio (`OverviewHeader`) com saudação, busca global e data. A sidebar
renderiza o rodapé de usuário (avatar, nome, cargo, "Sair").

O handoff (`README copy.md`) e o protótipo (`Redesign 22 - Fila de Pedidos em Abas.dc.html`)
são a referência visual; as medidas são em px a 1440 de largura. Restrições do projeto que
pesam aqui: nenhum hex fora de `@theme` (`pnpm check:tokens`), regra de negócio em `src/core`,
checagem de permissão no servidor, e2e completo só no CI.

## Goals / Non-Goals

**Goals:**
- Fila em abas por andamento, com contador, paginação server-side e filtros na URL.
- Fidelidade ao protótipo usando os tokens `admin-*` existentes (mais dois novos).
- Barra do topo única para o painel inteiro, sem quebrar as 22 telas que usam
  `AdminPageHeader`.
- Manter a ordem de prioridade dentro da aba e a ação em massa de arquivar.

**Non-Goals:**
- Mudar andamentos, banco ou o detalhe do pedido.
- Sino de notificações, "Trocar senha", layout de cartões no mobile, Radix/shadcn.
- Reformar as filas de LGPD, ouvidoria e agenda.

## Decisions

### 1. Abas são uma tabela declarativa em `queue-order.ts`, no lugar das bandas

`QUEUE_TABS: readonly { id, label, tone, statuses }[]`, nesta ordem: `new`,
`awaiting-compliance`, `awaiting-payment`, `payment-reported`, `paid`, `processing`,
`ready-for-pickup`, `closed` (= `done`, `rejected`, `cancelled`, `archived`). O id da aba é o
valor de `?aba=`; um valor desconhecido cai em `new`. `queueTabOf(status)` devolve a aba de um
andamento. `QUEUE_GROUPS`, `queueGroupOf` e `bandClass` saem.

**Por que oito abas e não as sete do handoff.** `payment-reported` foi mantido de propósito em
`enxugar-status-pedido` por ter comportamento próprio; sem coluna de andamento, juntá-lo a
"Pago" apagaria da tela a única diferença que interessa (o cidadão disse que pagou e a
serventia ainda não conferiu). O produto confirmou a aba em 2026-09-11 com uma condição: as
oito numa linha só. Com as medidas do protótipo (13.5px, padding lateral 11px) elas não cabem
a 1440px; com 13px e 6px cabem, e abaixo de 1120px de card uma container query troca os quatro
rótulos longos pela forma curta (`shortLabel` em `QUEUE_TABS`), o que deixa folga real. A linha
nunca rola de lado: abaixo de 1210px de viewport ela quebra, e acima disso as abas dividem a
linha em partes iguais (`flex-1`), para não ficarem empacotadas à esquerda numa tela larga. A linha de abas perde o
`flex-wrap` e ganha `overflow-x-auto`: numa tela mais estreita ela rola de lado em vez de
virar duas linhas, que leem como dois conjuntos de escolhas.

**Alternativa descartada:** derivar as abas de `STATUS_TONES` como hoje se derivam as bandas.
O tom agrupa andamentos diferentes (Novo e Aguardando pagamento são ambos âmbar) e a aba é por
andamento, então a tabela explícita é mais honesta que uma derivação com exceções.

### 2. `compareQueueRows` continua, sem a comparação por grupo

Dentro de uma aba em aberto a ordem é a de hoje (vencido → vence em breve → pausado há mais
tempo → chegada mais antiga). Na aba Finalizados, mais recente primeiro, sem agrupar por
andamento: a coluna Situação já distingue, e o agrupamento fazia sentido numa lista única que
não existe mais. O comparador perde o campo `group`; os testes de `queue-order.test.ts` que
cobrem bandas viram testes de `queueTabOf` e da ordem dentro de uma aba.

### 3. Paginação: SQL na aba Finalizados, memória nas abas em aberto

A ordem das abas em aberto depende de prazo e urgência, que são calculados em código a partir de
`details` (JSON), do catálogo de atos e da config do tenant. Não há coluna para o banco ordenar.
Então:

- **Abas em aberto:** `listServiceRequests({ statuses, attribution, search })` traz todas as
  linhas da aba (uma aba é uma fração pequena do total; o volume que preocupa está em
  Finalizados), a página ordena em memória e fatia com `pageSlice(rows, page, size)` (função
  pura, em `queue-order.ts`, com teste). `total = rows.length`.
- **Finalizados:** a ordem é `createdAt desc`, que o banco sabe fazer. `listServiceRequests`
  aceita `limit` e `offset`; `countServiceRequests` com os mesmos filtros dá o `total`.

`listServiceRequests` troca `status?: string` por `statuses?: readonly string[]`
(`inArray`); `status` simples deixa de existir porque nenhum outro chamador o usa com valor.
A assinatura fica `{ statuses?, attribution?, search?, limit?, offset? }`, ordem sempre
`createdAt desc` (a página reordena quando precisa).

**Alternativa descartada:** materializar o prazo numa coluna para paginar tudo em SQL. Exigiria
dois deploys, backfill e manter a coluna em sincronia com três fontes; não paga o custo enquanto
as abas em aberto se contam em dezenas.

**Página fora do intervalo** (`pagina` maior que o total de páginas, depois de arquivar a última
linha, por exemplo): a página é recalculada para a última existente, sem redirect.

### 4. Contadores das abas em uma query

`countByStatus(tenantSlug): Promise<Record<string, number>>` faz um `GROUP BY status` em
`service_requests` do tenant com `kind = "service-request"`. A página soma por aba a partir de
`QUEUE_TABS`. Os contadores ignoram atribuição e busca de propósito: são o tamanho de cada aba,
não do filtro, para o operador saber para onde ir. O badge da sidebar continua com
`openRequestCount` (mesma soma das abas em aberto, sem duplicar a query no layout).

### 5. URL é o único estado de servidor; seleção é o único estado de cliente

`?aba=<id>&atribuicao=<Attribution>&q=<texto>&pagina=<n>&por=<10|25|50>`. `queueSearchParams`
(função pura, testada) valida e normaliza: aba desconhecida → `new`; `por` fora de {10, 25, 50}
→ 10; `pagina` inválida → 1. Um helper `queueHref(current, patch)` monta o link com o patch
aplicado e **zera `pagina`** sempre que o patch toca `aba`, `atribuicao`, `q` ou `por`. Abas,
dropdowns, "Limpar" e paginação são `<Link>` com `scroll={false}`; a busca é um `<form
method="get">` com os demais parâmetros em `<input type="hidden">` e sem `pagina` (que volta a
1). Isso mantém a tela um server component e a URL compartilhável, como hoje.

A seleção (`Set<string>` de ids) fica em `QueueRows`, client component, e some ao navegar. O
checkbox do cabeçalho marca ou desmarca **a página atual**; "Desmarcar" limpa. A ação em massa
segue `deactivateServiceRequestsAction` sem mudança; ao terminar com sucesso o `revalidatePath`
já existente rerenderiza a lista e o componente limpa a seleção.

### 6. Barra do topo no layout; `AdminPageHeader` vira bloco de título

- **`AdminTopBar`** (server component, `src/app/admin/_components/top-bar.tsx`) é renderizado
  uma vez por `(dashboard)/layout.tsx`, acima de `{children}`: botão de menu mobile
  (`popovertarget={ADMIN_MENU_ID}`, `md:hidden`), `SearchTriggerButton` (placeholder "Buscar no
  painel", `max-w-[460px]`), chip do chat (lógica atual movida do `page-header.tsx`) e
  **`UserMenu`** (client component: avatar com `initials()`, nome, chevron; clique abre menu com
  o cargo de `ROLE_LABELS` e o form de `signOut` com `SignOutButton`; Escape e clique fora
  fecham).
- **`AdminPageHeader`** mantém nome e props (`title`, `back`) e ganha `description?: string` e
  `actions?: ReactNode`. Passa a renderizar o bloco de título dentro do conteúdo (h1 26px
  serif, subtítulo 13.5px, ações à direita), com o mesmo padding horizontal de `main`. Deixa de
  buscar dados. As 22 telas continuam a chamar `<AdminPageHeader title="…" />` antes de
  `<main>`; ganham o título novo sem edição. Por que manter o nome: reescrever 22 call sites
  para um componente novo com a mesma API é churn sem ganho; o nome "page header" ainda
  descreve o que ele é (o cabeçalho da página, não da casca).
- **`OverviewHeader`** perde a busca e a data (agora na barra) e fica só com saudação e contagem
  da mesa, no mesmo bloco de título.
- **Sidebar** perde o rodapé de usuário; `user` deixa de ser prop dela e passa para `AdminTopBar`.
  `initials()` continua exportada de `sidebar.tsx` (o shell travado de
  `/admin/redefinir-senha` a usa).
- A data por extenso sai do painel, como o design pede. `formatFullDate` continua em uso na
  agenda e no shell travado.

### 7. Dropdown e checkbox próprios, sem dependência nova

- **`Dropdown`** (`src/app/admin/_components/dropdown.tsx`, client): recebe `label`, `options:
  { value, label, href }[]` e `value`. Gatilho `<button aria-haspopup="menu" aria-expanded>`;
  menu `<ul role="menu">` com `<Link role="menuitemradio" aria-checked>` por opção. Abre e
  fecha no clique, fecha com Escape, clique fora e ao escolher; setas movem o foco entre
  opções. Opções como `<Link>` porque a seleção **é** uma navegação (muda a URL), o que dispensa
  `useRouter` e mantém o comportamento igual ao das abas. Não há `<select>` nativo por trás: o
  form de busca carrega os valores atuais em hidden inputs.
- **`Checkbox`** (`checkbox.tsx`): `<input type="checkbox">` com `appearance:none` e uma
  classe utilitária `.checkbox-admin` em `globals.css` cobrindo os estados (borda, hover,
  marcado com fundo `admin-primary` e o check desenhado por pseudo-elemento, foco visível com
  anel `admin-focus-ring`). Uma classe em CSS em vez de SVG inline por uso, para a linha e o
  cabeçalho da tabela compartilharem o mesmo desenho.

### 8. Colunas, prazo e situação

- Grid das abas em aberto: `22px 150px 1.6fr 1.4fr 90px 200px 96px` (checkbox · Protocolo ·
  Solicitante · Ato · Criado em · Prazo · Ações). Finalizados: `… 90px 150px 96px` com Situação
  no lugar de Prazo. O container tem `overflow-x-auto` e a tabela `min-w-[900px]` para telas
  estreitas.
- `DeadlineBadge` ganha a variante de folga (`running`): texto simples "Vence em dd/mm" a partir
  de `deadline.due` (hoje devolve `null`). Em `ready-for-pickup` a coluna mostra "—": não há
  prazo da serventia a cobrar, só a retirada pelo cidadão. O detalhe do pedido continua chamando
  o badge com o comportamento de hoje via prop `showRunning={false}` (padrão), para o requisito
  do detalhe não mudar.
- Situação: pill por andamento terminal, usando `statusBadgeClass` de `status-tone.ts` (os tons
  já batem com o handoff: Concluído `delivered`, Indeferido `blocked`, Cancelado/Arquivado
  `closed`).
- `ATTRIBUTION_SHORT` sai de `page.tsx` para `src/core/tenant/schema.ts` (ao lado de
  `ATTRIBUTIONS`), já que a linha e o dropdown o usam.

### 9. Tokens novos

`--color-admin-footer-bg` (`#fbfaf7`, rodapé da paginação) e `--color-admin-focus-ring`
(`#b7cdbd`). Os demais hex do handoff mapeiam para tokens existentes: `#123c2a`
`admin-primary`, `#1c5638` `admin-success-text`, `#8f7238` `admin-on-dark-accent` (contador da
sidebar) / `admin-warning-text` para texto âmbar, `#e3dfd4` `admin-border`, `#c9cfc4`
`admin-input-border`, `#f7f5ef` `admin-input-bg`, `#e9efea` `admin-success-bg`, `#eceae3`
`admin-readonly-bg`, `#f7e6e2`/`#b04a38` `admin-error-bg`/`admin-error-text`. Onde o hex do
protótipo difere em um tom do token (ex.: `#8f9a90` vs `admin-faint #616c62`), vence o token:
a marca é do tenant, não do protótipo.

### 10. Loading

`pedidos/loading.tsx` com o card, as abas sem contador e dez linhas de 49px em `animate-pulse`.

## Risks / Trade-offs

- [Paginação em memória nas abas em aberto carrega a aba inteira] → As abas em aberto são o
  trabalho corrente da serventia, dezenas de linhas; Finalizados, que cresce sem limite, pagina
  no banco. Se uma aba em aberto passar de algumas centenas, o caminho de SQL já existe para
  ser estendido com uma coluna de prazo.
- [Barra do topo muda todas as telas de uma vez] → `AdminPageHeader` mantém API; `pnpm
  typecheck` aponta qualquer call site quebrado; os e2e de login, busca global e chat cobrem a
  barra. Conferir cada tela a olho fica registrado como tarefa.
- ["Sair" passa a exigir dois cliques] → Preço do menu do usuário; os e2e que clicam em "Sair"
  passam a abrir o menu antes. O botão continua um `<form action={signOut}>`, então a semântica
  de servidor não muda.
- [Seleção some ao trocar de página] → É o comportamento do handoff e evita ações em massa sobre
  linhas que o operador não está vendo. A barra de seleção diz quantos estão marcados.
- [Contadores das abas ignoram filtro e busca] → Decisão explícita (decisão 4): o rodapé
  "Exibindo X a Y de Z" é quem reflete o filtro.
- [Placeholder da busca global muda para "Buscar no painel"] → O e2e de busca global usa o
  placeholder; ajustar junto.

## Migration Plan

Sem migração de dados. Deploy único. Rollback é reverter o merge: nada no banco muda.

## Open Questions

- Nenhuma que bloqueie. Uma decisão de produto tomada aqui e passível de reversão barata: o
  rótulo "Arquivar" no lugar de "Apagar" (proposal). A aba "Pagamento informado" (decisão 1)
  já foi confirmada pelo produto.
