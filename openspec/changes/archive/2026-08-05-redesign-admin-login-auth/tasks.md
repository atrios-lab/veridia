# Tasks: Redesign — Painel admin: Login e autenticação

Referência visual: projeto Claude Design `558c4556-caed-4f30-9c6b-648f995805cf`, arquivo
`Redesign 05 - Admin Login e Autenticação.dc.html` (buscar via `DesignSync get_file`; seções
`#1a` a `#1d`). Cada fluxo é escrito do zero.

## 1. Marca e tokens visuais

- [x] 1.1 `TenantSchema.logos.seal` vira `{ light: string; dark: string }`; atualizar
      `tenants/marinho.ts` e `tenants/aurora.ts` com a segunda chave (`CM-Sublogo-branco.png`
      já existe em `public/logos/`); atualizar `tenant.test.ts`
- [x] 1.2 Atualizar os dois usos existentes de `logos.seal` (`src/app/layout.tsx` favicon,
      `src/app/(public)/layout.tsx` cabeçalho) para `logos.seal.light`
- [x] 1.3 Em `src/app/globals.css`, novo bloco `@theme static` "Admin, fixo" com
      `--palette-admin-*` (primary, primary-soft, surface, card, border, input-bg,
      input-border, muted, faint, on-dark-subtitle, on-dark-muted, error-bg, error-text,
      error-border, warning-bg, warning-text, success-bg, success-text) e `@theme inline`
      expondo `--color-admin-*`; conferir `pnpm check:tokens` continua passando

## 2. Sessão e redirecionamento

- [x] 2.1 ~~`hasSessionCookie(headers)` em `src/lib/session.ts`~~ — desnecessário: o
      `middleware.ts` já existente só deixa passar quem tem cookie de sessão (redireciona quem
      não tem antes de chegar no layout), então a checagem de banco do dashboard layout já
      falhando implica cookie presente. Ver design.md, decisão 3, "corrigido na implementação".
- [x] 2.2 `(dashboard)/layout.tsx`: ao recusar acesso, redireciona para
      `/admin/login?next=<path>&motivo=expirada` (`next` lido de um header `x-pathname` que o
      middleware passa a encaminhar em toda requisição de `/admin/*`)
- [x] 2.3 `signOut()` em `actions.ts`: redireciona para `/admin/login?saiu=1`

## 3. Tela de login (1a, 1b, 1c)

- [x] 3.1 Reescrever `src/app/admin/login/page.tsx`: painel institucional (selo `seal.dark`,
      nome, subtítulo, texto do painel) + formulário, layout de duas colunas conforme o design,
      responsivo. `src/app/admin/layout.tsx` novo carrega a Spectral fixa do painel (única
      serifada do admin, nunca a do tenant); `_components/icon.tsx` e `_components/
      password-field.tsx` (Client Component, toggle mostrar/ocultar) próprios do admin.
- [x] 3.2 Estados de aviso mutuamente exclusivos por prioridade de leitura de `searchParams`:
      `erro=1` (genérico), `erro=limite` (âmbar, botão desabilitado "Aguarde…"),
      `motivo=expirada` (verde, com destino resolvido por `ADMIN_DESTINATION_LABELS`),
      `saiu=1` (verde, "Você saiu do painel.")
- [x] 3.3 Texto fixo abaixo do formulário: sem "esqueci a senha", orienta a pedir o convite ao
      registrador

## 4. Convite de primeiro acesso (1d)

- [x] 4.1 Lida a API `resetPassword`/`requestPasswordReset` em
      `node_modules/better-auth/dist/api/routes/password.mjs` (v1.6.25): confirmada a premissa
      — conta precisa existir antes do link (`resetPassword` cria a `credential` account se
      não houver uma, ou atualiza se houver), token vive em `verification` com identificador
      `reset-password:<token>`, expiração lida de `resetPasswordTokenExpiresIn`. Achado extra:
      `sendResetPassword` só é exigido pelo endpoint HTTP `requestPasswordReset`
      ("enviar e-mail") — como o script de convite grava o token direto via
      `ctx.internalAdapter` (mesmo padrão de `seed-admin.ts`), não precisou ser configurado.
- [x] 4.2 `src/lib/auth.ts`: `resetPasswordTokenExpiresIn` de 48h
- [x] 4.3 `src/app/admin/redefinir-senha/page.tsx`: lê `?token=`, formulário de nova senha +
      confirmação; ação de servidor (`actions.ts`) lê a conta por trás do token (para saudar
      pelo nome e poder logar depois), chama `resetPassword`, confere a serventia com o mesmo
      guard do login normal e entra automaticamente em caso de sucesso
- [x] 4.4 Branch de link vencido/inválido: sem formulário, mensagem de quem emite um novo
      convite, sem opção de reenvio para si mesma
- [x] 4.5 `scripts/invite-admin.ts` (`pnpm db:invite <email>`) emite um token de convite para
      um usuário existente e imprime o link (substitui, por ora, a tela de Usuários da
      Entrega 4); `middleware.ts` passa a exentar `/admin/redefinir-senha` do gate de cookie,
      já que quem abre o convite ainda não tem sessão nenhuma

## 5. Verificação

- [x] 5.1 `e2e/admin-login.spec.ts`: 4 cenários sem banco (identidade/sem aviso, erro
      genérico/limite, sessão expirada/saída por texto, visita não autenticada sem aviso) e 3
      com banco (`test.skip` sem `DATABASE_URL`/`ADMIN_SEED_*`): login com sucesso + senha
      errada, conta de outra serventia recusada no domínio errado, sessão revogada no banco
      redireciona com `motivo=expirada` e volta a `/admin` depois de logar de novo. Ajustado
      `e2e/tenants.spec.ts` (heading "Entrar" virou `h2`, não `h1`, no redesign). Adicionado
      `data-admin-banner` nos 4 avisos do login (mesmo padrão de `data-section` já usado),
      porque `getByRole("alert"/"status")` colide com o `#__next-route-announcer__` do Next.
- [x] 5.2 `src/db/invite.test.ts` (PGlite, mesmo padrão de `session-revocation.test.ts`, sem
      banco real): token válido cria senha num usuário sem conta de credencial e entra; token
      vencido é recusado e não deixa senha nenhuma valer. A checagem por texto/branch do
      `/admin/redefinir-senha` foi conferida manualmente no browser (link real emitido por
      `pnpm db:invite`, os dois branches, e o auto-login).
- [x] 5.3 Conferidos os dois tenants no dev (marinho, aurora): mesma estética de login nos
      dois, só selo/nome/subtítulo mudam (aurora com tema marinho-bronze no site público,
      painel de login idêntico ao de marinho). `pnpm typecheck`, `pnpm lint`, `pnpm test` (107
      testes), `pnpm check:dashes`, `pnpm check:tokens`, `pnpm build` e `pnpm e2e` (15 testes,
      `admin-login.spec.ts` + `tenants.spec.ts`, com `DATABASE_URL` local) todos limpos.
