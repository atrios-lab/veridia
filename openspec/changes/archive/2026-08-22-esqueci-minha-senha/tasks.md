## 1. Preparar o utilitário compartilhado

- [x] 1.1 Mover `resolveOrigin` de `src/app/admin/(dashboard)/usuarios/actions.ts` para `src/lib/auth-tokens.ts`, ao lado de `buildResetPasswordUrl`, e ajustar o import no chamador existente

## 2. Fluxo de pedido de nova senha

- [x] 2.1 Criar `src/app/admin/esqueci-senha/actions.ts` com `requestPasswordReset`: rate limit por `isRateLimited`, busca por `email` + `tenantSlug` + `disabledAt IS NULL`, e emissão/envio via `issueResetTokenWith` + `buildResetPasswordUrl` + `sendPasswordResetEmail`
- [x] 2.2 Garantir a resposta neutra: mesmo estado de retorno para conta encontrada, ausente, desativada e de outra serventia; estado distinto só para o limite de tentativas
- [x] 2.3 Registrar auditoria `user.password-reset-self-request` apenas quando o e-mail foi de fato enviado
- [x] 2.4 Criar `src/app/admin/esqueci-senha/page.tsx` no layout da tela de login (selo, nome e subtítulo da serventia), com campo de e-mail, `SubmitButton` e o aviso de limite

## 3. Ligar as pontas

- [x] 3.1 Trocar o rodapé de `src/app/admin/login/page.tsx` por um link para `/admin/esqueci-senha`, mantendo a menção a quem responde pela serventia
- [x] 3.2 Na tela de link vencido (`src/app/admin/redefinir-senha/page.tsx`), oferecer o caminho para `/admin/esqueci-senha`

## 3b. Liberar a rota no guard (descoberta na verificação)

- [x] 3b.1 Incluir `/admin/esqueci-senha` nas rotas sem sessão de `src/middleware.ts`, que antes redirecionava a tela nova para o login

## 4. Verificação

- [x] 4.1 Rodar `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm check:dashes` e `pnpm check:tokens`
- [x] 4.2 Cobrir a decisão de envio (ativa envia, inexistente/desativada/outra serventia não enviam) com teste, no padrão dos testes de `src/db/` que sobem Postgres em processo com PGlite
- [x] 4.3 Exercitado no servidor de dev contra o banco real, apenas no caminho que não escreve nem envia (e-mail sem conta): resposta neutra confirmada e nenhuma linha `[email]` no log. O caminho da conta ativa NÃO foi exercitado de propósito: o banco é o de produção e emitir token gravaria linha em `verification` de conta real (a decisão dos quatro ramos está coberta por `src/db/password-reset-self.test.ts`)
