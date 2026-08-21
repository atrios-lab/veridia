## 1. Caminho permanente para a configuração

- [x] 1.1 Em `src/app/admin/(dashboard)/agenda/page.tsx`, adicionar no topo do `<main>`, fora do
  bloco condicional `!hasGrid(config)`, um `<Link href="/admin/agenda/configuracao">` alinhado à
  direita, com o mesmo estilo do `‹ Voltar para a agenda` da tela de configuração
  (`text-[12.5px] font-semibold text-admin-accent underline`)
- [x] 1.2 Escrever o rótulo dizendo o que a tela faz, não onde ela fica (a tela edita horários,
  serviços e modos), e conferir com o tom das outras telas do painel
- [x] 1.3 Confirmar que o aviso de grade vazia e seu botão "Definir os horários" continuam
  intactos

## 2. Verificação

- [x] 2.1 Em `e2e/admin-agenda.spec.ts`, cobrir o cenário da spec: com a grade preenchida, a
  agenda do dia oferece o caminho e ele leva à tela de configuração com os campos preenchidos
- [x] 2.2 Rodar `pnpm lint`, `pnpm typecheck` e `pnpm check:tokens` (nenhum hex fora de
  `@theme`)
- [x] 2.3 Abrir `/admin/agenda` no app com a grade preenchida e com a grade vazia, e confirmar
  os dois estados da spec
