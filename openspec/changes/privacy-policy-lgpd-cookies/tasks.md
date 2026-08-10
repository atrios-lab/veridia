## 1. Página de política de privacidade

- [x] 1.1 Criar `src/app/(public)/privacidade/page.tsx` (Server Component) com a política:
      dados coletados por canal, base legal, prazos de guarda, direitos do titular com link
      para `/lgpd` e prazo de 15 dias, Encarregado via `tenant.dpo`, seção de cookies
      "apenas essenciais"; dados institucionais via `getTenant()`
- [x] 1.2 Adicionar link "Política de privacidade" para `/privacidade` no rodapé de
      `src/app/(public)/layout.tsx`

## 2. Aviso de cookies

- [x] 2.1 Criar componente cliente `cookie-notice.tsx` em `src/app/(public)/_components/`:
      banner fixo na base, não modal, tokens `brand-*`, link para `/privacidade`, botão
      "Entendi" que grava `cookie-notice-ack=1` (SameSite=Lax, 1 ano) via `document.cookie`
      e esconde o banner
- [x] 2.2 No layout público, ler o cookie via `cookies()` e renderizar o banner somente
      quando ausente (sem flash, sem JS para quem já deu ciência); admin intocado

## 3. Verificação

- [x] 3.1 Teste Playwright: primeira visita mostra o banner, "Entendi" persiste a ciência e
      o banner não reaparece após recarregar; `/privacidade` exibe nome e e-mail do DPO do
      tenant
- [x] 3.2 Rodar Biome, typecheck e a suíte existente
