## Why

Ao clicar em um item da sidebar do painel, a navegação acontece mas o destaque de página atual
continua no item anterior. O `layout.tsx` do grupo `(dashboard)` lê o caminho do header
`x-pathname` posto pelo middleware, e o App Router não re-renderiza um layout compartilhado em
navegação no cliente: a sidebar fica com o caminho do primeiro carregamento até um recarregamento
de página inteira. Quem opera o painel perde a referência de onde está.

## What Changes

- O destaque de página atual da sidebar passa a ser decidido no cliente, a partir do caminho real
  da navegação, e não do header de request congelado no layout.
- O `x-pathname` continua servindo o que só existe no servidor: o `next=` do redirect de sessão
  expirada no layout.
- Teste automatizado que falha se o destaque voltar a ficar preso: navegação entre dois módulos
  sem recarregar a página.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `admin-shell`: o requisito de navegação passa a exigir que o destaque de página atual acompanhe
  a navegação no cliente, não apenas o carregamento inicial.

## Impact

- `src/app/admin/_components/sidebar.tsx` — a lista de itens deixa de receber `pathname` por prop
  e passa a resolvê-lo no cliente.
- `src/app/admin/(dashboard)/layout.tsx` — para de repassar `pathname` para a sidebar; mantém o
  uso no redirect.
- `src/app/admin/_components/locked-sidebar.tsx` — conferir que a casca sem navegação não é
  afetada.
- `e2e/` — um teste de navegação entre módulos.
- Sem mudança de banco, de permissão ou de API.

## Não-objetivos

- Não redesenhar a sidebar, seus grupos, ícones ou badges.
- Não mudar o cálculo dos contadores (`counts`), que seguem vindo do servidor.
- Não introduzir estado global de navegação nem biblioteca nova.
- Não mexer no `x-pathname` do middleware nem em outros consumidores dele.
