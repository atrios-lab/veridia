## Context

O shell público vive em `src/app/(public)/layout.tsx`, componente de servidor. A barra do desktop
mostra quatro seções mais "Início" e o botão de consulta; o menu do celular lista todas as seções
habilitadas na ordem do gating; o rodapé agrupa por tarefa ("Serviços" / "Cidadão") a partir de
uma lista de hrefs escrita ali mesmo. Os links são `NavLinks`, componente cliente que marca a
página aberta por `usePathname` (ver `mark-current-section-in-site-menu`, arquivado).

O menu do celular é um popover nativo. `MenuPopover`, dentro dele, fecha o painel numa navegação
e faz as vezes da API onde ela não existe (iOS 16, Safari antes de 17).

O e2e de gating (`tenants.spec.ts`) compara o conjunto de `data-section` da página com
`enabledSections`, e o de navegação (`public-nav.spec.ts`) confere a marcação da página atual no
menu do celular e no cabeçalho.

## Goals / Non-Goals

**Goals:**

- Toda página habilitada alcançável a partir do cabeçalho, no desktop e no celular, com rótulo
  que se entende.
- Cabeçalho que cabe em qualquer largura.
- Um lugar só dizendo onde cada página vive.

**Non-Goals:**

- Ver `proposal.md`.

## Decisions

### 1. Dois submenus na barra, "Serviços" e "Cidadão", não uma segunda linha nem tudo na barra

Tudo na barra não cabe: dez links mais o botão passam de 1024px. Uma linha utilitária acima da
barra (o padrão dos sites de governo) coloca todos os links à vista, mas acrescenta uma faixa
sobre todas as páginas. A barra fica com cinco itens fixos (Início, Serviços, Cidadão, Contato,
Transparência) e o botão de consulta; os dois grupos abrem um submenu que diz o que cada página
é, que é o que "Centrais" e "Selo digital" precisavam. Contato e Transparência têm link próprio
na barra por serem as duas páginas institucionais mais procuradas, e por isso saem do submenu
"Cidadão", embora continuem nesse grupo no celular e no rodapé.

A barra é uma lista ordenada (`HEADER_ITEMS`) em que cada item ou é um endereço, que vira link,
ou é o título de um grupo, que vira submenu. Um submenu é o grupo menos o que a barra já mostra
sozinha, e some se não sobra nada.

### 2. Um submenu é popover nativo, ancorado por CSS

O mesmo padrão do menu do celular: abre sem JavaScript, o navegador fecha com Escape e com o
clique fora, e `MenuPopover` fecha na navegação. Um popover renderiza na top layer, então nenhum
wrapper posiciona o painel sob o botão. Onde o navegador tem ancoragem por CSS (Chrome 125,
Safari 26), `anchor()` pendura o painel sob o botão que o abriu, que é o âncora implícito de um
popover, sem precisar de nome. Onde não tem, o painel fica na borda direita do cabeçalho.

Alternativa descartada: `<details>`, que abre sem JavaScript mas não fecha com Escape nem com o
clique fora (proposta 8 de `UX_PROPOSALS.md`).

### 3. A descrição de cada página vive no núcleo, ao lado do rótulo

`SECTION_DESCRIPTIONS` em `gating.ts`, uma linha por seção, e `sectionNavLinks` passa a devolver
a descrição de cada link (a seção "Centrais e contato" abre duas páginas, cada uma com a sua). A
home já tinha essas frases escritas nos cards; passa a ler de lá, para o site descrever uma
página de um jeito só.

Só os submenus da barra mostram as descrições. No celular, onze itens em duas linhas passam da altura
de um iPhone SE, e a lista agrupada já resolve o problema que o celular tinha, que era ordem.

### 4. Uma lista de grupos, por endereço

`NAV_GROUPS` no layout, com título e hrefs, alimenta o rodapé, o menu do celular e os submenus
da barra. Por href e não por seção porque uma seção pode abrir duas páginas. O conjunto de
`data-section` do rodapé não muda, e o e2e de gating continua valendo sem alteração.

### 5. A barra completa só a partir de `lg`

Medido: 807px de conteúdo em 768px de janela. Em 1024px a barra cabe, com o subtítulo de um
cartório de nome comprido (Taipu) quebrando em duas linhas ao lado do selo. Entre 768px e 1023px
vale o menu do celular, que já resolve o mesmo conjunto de páginas. `whitespace-nowrap` nos links
para um rótulo nunca mais quebrar em duas linhas.

## Risks / Trade-offs

- **Firefox sem ancoragem por CSS.** O painel encosta na borda direita do cabeçalho em vez de
  pendurar sob o botão. Funciona igual; só não é tão preciso.
- **Sem a API popover (iOS 16).** Nem se chega aos submenus: eles só existem a partir de 1024px,
  e a API já falta só em celular. Ainda assim, `MenuPopover` cobre cada painel do mesmo jeito que
  cobre o menu.
- **Mais um componente cliente, o botão do grupo.** Sem ele, quem está em "Solicitar serviço"
  não vê nada marcado na barra, porque o link está dobrado dentro do painel fechado. O botão
  recebe o mesmo destaque dos links da barra e `aria-current="true"` (nunca "page", que continua
  sendo só do link), pelo mesmo `usePathname` de `nav-links.tsx`.

## Migration Plan

Nada a migrar: sem banco, sem configuração, sem conteúdo de tenant. Rollback é reverter o commit.

## Open Questions

- "Centrais" como rótulo continua opaco no celular, onde não há descrição. Renomear a seção é
  decisão à parte (muda a home e o e2e).
