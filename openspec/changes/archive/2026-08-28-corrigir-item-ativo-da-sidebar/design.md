## Context

`src/app/admin/(dashboard)/layout.tsx` lê `x-pathname` (posto por `src/middleware.ts`) e repassa
para `AdminSidebar`, que compara `pathname === item.href` para marcar o item atual. O layout é
compartilhado por todas as telas do grupo `(dashboard)`: em navegação no cliente o App Router
reaproveita o layout já renderizado e não refaz o request que traria o header novo. O valor de
`pathname` fica o do primeiro carregamento, e o destaque congela no módulo em que a sessão
começou — o que o usuário vê como "clica em um, fica selecionado o anterior".

Nada mais na sidebar depende de request: `tenant`, `user` e `counts` já chegam como props
serializáveis. O `usePathname()` de `next/navigation` é a leitura correta do caminho durante a
navegação no cliente.

## Goals / Non-Goals

**Goals:**

- O item destacado é sempre o da rota em que a pessoa está, em navegação no cliente ou em
  carregamento direto.
- Manter o resto da sidebar como está: mesmos itens, mesma filtragem por permissão no servidor,
  mesmos contadores.
- Deixar um teste que falha se a regressão voltar.

**Non-Goals:**

- Transformar a sidebar inteira em client component: o cabeçalho do tenant (`next/image` com o
  selo), o rodapé com `signOut` e a filtragem por permissão continuam no servidor.
- Mudar o middleware ou o `x-pathname`, que segue servindo o redirect de sessão expirada.
- Qualquer mudança visual.

## Decisions

**A lista de itens vira um client component; o resto da sidebar não.**
Um `sidebar-nav.tsx` com `"use client"` recebe os itens já filtrados e os `counts` como props e
resolve o caminho com `usePathname()`. `AdminSidebar` continua server component e faz o `can()`
como hoje — esconder link segue sendo cortesia decidida no servidor, e a lista que chega ao
cliente já não contém o que a pessoa não pode ver.

Alternativa descartada: marcar o destaque com CSS a partir de um atributo no `<body>`. Resolveria
sem client component, mas depende de o atributo ser atualizado na navegação — o mesmo problema,
em outro lugar.

Alternativa descartada: `AdminSidebar` inteira como client component. Puxaria `signOut`,
`ROLE_LABELS` e o selo do tenant para o bundle sem necessidade.

**`pathname` sai das props de `AdminSidebar`.**
Deixar a prop aceitando um valor que ninguém deve usar é o convite para a regressão. O layout
para de passá-la e mantém o `x-pathname` só no `next=` do redirect.

**Comparação continua `pathname === item.href`.**
As rotas de detalhe (`/admin/lgpd/[protocolo]`) hoje não destacam o item do módulo, e isso não é
o que foi reportado. Mudar para prefixo é outra decisão, para outra proposta.

## Risks / Trade-offs

- Um pedaço da sidebar passa a ser client component: alguns KB de JS a mais. Aceitável — a lista
  é markup pequeno e sem dependências além de `next/link` e do `AdminIcon`, já usado ali.
- `AdminIcon` precisa ser seguro no cliente (SVG puro, sem import de servidor). Verificar na
  implementação.
- `locked-sidebar.tsx` não tem navegação; não deve ser tocado, só conferido.
