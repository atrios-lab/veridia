## 1. Ícone

- [x] 1.1 Adicionar `mail` (envelope) ao `PATHS` de `src/app/admin/_components/icon.tsx`, com
      comentário no padrão dos vizinhos indicando que é navegação da sidebar

## 2. Item de navegação

- [x] 2.1 Adicionar o campo opcional `external?: true` a `AdminNavItem` em
      `src/app/admin/_components/nav.ts`, documentando que marca destino fora do aplicativo
- [x] 2.2 Atualizar o comentário do bloco `ADMIN_NAV`: a regra "só rotas que existem" passa a
      admitir item externo declarado
- [x] 2.3 Inserir o item "Zoho Mail" (`group: "Operação"`, `icon: "mail"`, `external: true`,
      href `https://mail.zoho.com/zm/#mail/folder/inbox`) imediatamente após "Pedidos de
      serviço" no array — a posição importa: `navGroups` agrupa por adjacência, e um item de
      "Operação" longe dos seus criaria um segundo cabeçalho "Operação" no rodapé do menu

## 3. Renderização na sidebar

- [x] 3.1 Em `src/app/admin/_components/sidebar.tsx`, aplicar `target="zoho"` e
      `rel="noreferrer"` quando `item.external`, e nada disso quando não for
- [x] 3.2 Renderizar o sinal `↗` no lugar do badge de contagem para item externo, com
      `aria-hidden` e um rótulo acessível que diga que o link abre fora do painel
- [x] 3.3 Confirmar que `aria-current` e o badge continuam desligados para o item externo sem
      código extra (o href absoluto nunca iguala `pathname`, e `counts` nunca tem essa chave)

## 4. Verificação

- [x] 4.1 Teste de unidade de `navGroups` com o array real: "Operação" aparece uma única vez e
      contém "Zoho Mail" logo após "Pedidos de serviço"
- [ ] 4.2 No painel rodando, conferir os três comportamentos do item: abre fora, reusa a mesma
      aba em cliques repetidos, e nenhum item aparece como página atual ao voltar
- [x] 4.3 `pnpm lint`, `pnpm typecheck` e `pnpm test`
