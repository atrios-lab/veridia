## 1. Mover o destaque para o cliente

- [x] 1.1 Conferir que `AdminIcon` (`src/app/admin/_components/icon.tsx`) roda no cliente sem
      dependência de servidor
- [x] 1.2 Criar `src/app/admin/_components/sidebar-nav.tsx` com `"use client"`: recebe os itens já
      filtrados e `counts`, resolve o caminho com `usePathname()` e renderiza os grupos, links,
      badges e o marcador de item externo exatamente como hoje
- [x] 1.3 Em `sidebar.tsx`, manter a filtragem por permissão no servidor e delegar a lista ao novo
      componente; remover a prop `pathname` e o bloco de navegação que saiu
- [x] 1.4 Em `(dashboard)/layout.tsx`, parar de passar `pathname` para `AdminSidebar`, mantendo o
      `x-pathname` no `next=` do redirect de sessão expirada
- [x] 1.5 Conferir que `locked-sidebar.tsx` segue intacta e sem navegação

## 2. Provar e fechar

- [x] 2.1 Teste e2e: entrar no painel, ir a um módulo, clicar em outro item da sidebar sem
      recarregar e afirmar que só o novo item tem `aria-current="page"`
- [x] 2.2 Rodar `pnpm biome check`, o typecheck, `node --test` e o e2e novo
- [x] 2.3 Verificar no navegador pelo host do cartório: clicar entre três módulos e ver o destaque
      acompanhar
