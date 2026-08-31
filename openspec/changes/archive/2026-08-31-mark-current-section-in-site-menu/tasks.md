## 1. A lista de links

- [x] 1.1 Criar um componente cliente em `src/app/(public)/_components/` que receba os links já montados (`{ label, href }[]`) e renderize cada um marcando com `aria-current="page"` o cujo `href` seja exatamente igual ao `usePathname()`.
- [x] 1.2 Dar ao item marcado um destaque visual que funcione no menu claro do site, usando os tokens de marca já existentes (nada de hex fora do `@theme`).
- [x] 1.3 Comentar no topo do arquivo por que ele é cliente, apontando para a mesma armadilha que `admin/_components/sidebar-nav.tsx` documenta: o layout não é recriado numa navegação de cliente.

## 2. O shell público

- [x] 2.1 Em `src/app/(public)/layout.tsx`, usar o componente novo dentro da `<nav id="site-menu">`, mantendo o `<MenuPopover />` onde está.
- [x] 2.2 Usar o mesmo componente na navegação do cabeçalho de desktop, para os dois não saírem do passo.
- [x] 2.3 Deixar o rodapé como está: é atalho, não localização (ver `proposal.md`, não-objetivos).

## 3. Testes

- [x] 3.1 Teste e2e no site público: abrir o menu e afirmar que a página aberta tem `aria-current="page"` e é a única marcada. Usa `/solicitar` e não `/transparencia`, que foi a do relato: aquela lê documentos do banco e não serve sem ele.
- [x] 3.2 Teste e2e da navegação no cliente: de `/editais`, tocar em "Ouvidoria" e afirmar que a marcação passou, sem recarregar.
- [x] 3.3 Teste e2e da seção de dois links: em `/contato`, afirmar que "Contato" está marcada e "Centrais" não.
- [x] 3.4 Teste e2e de rota fora do menu: em `/privacidade`, afirmar que nenhuma opção está marcada.
- [x] 3.5 Rodar `pnpm typecheck`, `pnpm lint`, `pnpm test`, `check:dashes`, `check:tokens` e `check:a11y`. Os e2e novos não tocam banco, então rodaram aqui com `DATABASE_URL` vazio: 5 passando, mais os 23 de `tenants.spec.ts`.

## 4. Fechamento

- [x] 4.1 Abrir PR referenciando SCRUM-20 e deixar a branch pronta; o merge é decisão do Vinícios.
- [x] 4.2 Depois do merge, `openspec archive mark-current-section-in-site-menu`.
