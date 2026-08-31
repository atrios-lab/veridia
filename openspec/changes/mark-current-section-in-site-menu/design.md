## Context

O menu do site vive em `src/app/(public)/layout.tsx`, que é componente de servidor. Ele monta os
links a partir das seções habilitadas do tenant, passando cada uma por `sectionNavLinks`, que
devolve um ou mais `{ label, href }` — "Centrais e contato" é a única que devolve dois.

O painel resolve o mesmo problema em `src/app/admin/_components/sidebar-nav.tsx`, e o comentário
no topo daquele arquivo registra por que ele é cliente: o App Router reaproveita o layout numa
navegação de cliente em vez de recriá-lo, então um caminho lido do pedido congela no da primeira
carga e o destaque trava na tela em que a sessão começou.

O menu do celular é um popover nativo cujo comportamento já depende de um componente cliente,
`MenuPopover`, dentro dele.

## Goals / Non-Goals

**Goals:**

- Marcar a página aberta no menu e no cabeçalho, de um jeito que sobreviva à navegação no cliente.
- Reusar o padrão que o painel já usa, em vez de inventar um segundo.

**Non-Goals:**

- Marcar o rodapé (ver `proposal.md`).
- Tornar o layout público inteiro um componente cliente.
- Mexer no gating, no desenho do menu ou na navegação do painel.

## Decisions

### 1. A rota atual vem de `usePathname`, no cliente

Não do header `x-pathname` que o servidor tem à mão. É a armadilha registrada em
`sidebar-nav.tsx`: o layout público não é recriado numa navegação de cliente, então o caminho
lido do pedido continua sendo o da primeira página aberta na sessão, e o destaque congela ali. O
sintoma é pior que a ausência do destaque, porque aponta para o lugar errado com confiança.

Alternativa descartada: marcar no servidor e forçar recriação do layout. Custa uma navegação de
página inteira a cada clique, para resolver uma linha de destaque.

### 2. Só a lista de links vira cliente

O layout continua servidor. Quais links existem é decisão de servidor — depende do tenant e do
gating — e o que atravessa a fronteira é a lista já filtrada, como acontece com a sidebar do
painel, que recebe `items` já peneirados por permissão.

### 3. A comparação é por `href`, exata

Não por prefixo. Comparação por prefixo faria `/` marcar todas as páginas, já que toda rota começa
com barra, e faria "Centrais" acender junto de "Contato" se algum dia as rotas se aninhassem. A
igualdade exata também é o que dá o cenário "fora das seções, nada é marcado": uma página que o
menu não lista simplesmente não casa com nenhum link, sem precisar de caso especial.

É a mesma comparação que `sidebar-nav.tsx` faz (`pathname === item.href`).

## Risks / Trade-offs

- **Mais um componente cliente no site público.** → É uma lista de links; o JavaScript que ela
  acrescenta é o `usePathname`. O menu já carrega um componente cliente dentro dele.
- **Destaque some enquanto a página não hidrata.** → O link continua clicável e legível o tempo
  todo; o que falta por um instante é o realce. A alternativa congela o realce no lugar errado,
  que é pior.
- **Dois lugares marcando a página, menu e cabeçalho.** → Um componente só, usado nos dois, ou o
  segundo sai do passo do primeiro na próxima mudança.

## Migration Plan

Nada a migrar: sem banco, sem configuração, sem conteúdo de tenant. Rollback é reverter o commit.

## Open Questions

- O destaque deve usar o mesmo peso visual do painel (fundo sólido) ou algo mais leve, já que o
  menu público é claro e o do painel é escuro? Decisão de acabamento, para a implementação.
