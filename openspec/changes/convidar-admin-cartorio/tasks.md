## 1. Texto do e-mail (núcleo puro)

- [x] 1.1 Em `src/core/auth/invite.ts`, adicionar o `kind: "boas-vindas"` a `AccountEmailInput`
      (`recipientName`, `inviterName`, `roleLabel`, `tenantName`) e o ramo correspondente em
      `buildAccountEmailText`: assunto nomeando a serventia, parágrafo de boas-vindas com quem
      convidou e o papel, um parágrafo sobre o enquadramento no Provimento CN-CNJ n. 213/2026 e
      na LGPD afirmando só o que o produto entrega (conta individual, auditoria, canais de
      ouvidoria e de direitos do titular), botão "Criar minha senha e entrar", rodapé com 48h /
      uso único / depois entra com e-mail e senha
- [x] 1.2 No mesmo arquivo, `inviteEmailKind(role: string): "convite" | "boas-vindas"` — devolve
      `"boas-vindas"` só para `"superadmin"`
- [x] 1.3 Testes em `src/core/auth/invite.test.ts`: boas-vindas nomeia serventia, convidante,
      papel, Provimento 213 e LGPD, e nunca uma senha (mesma asserção do teste do convite);
      `inviteEmailKind` devolve boas-vindas para superadmin e convite para admin/staff/vazio

## 2. Transporte

- [x] 2.1 Em `src/lib/email/index.ts`, `sendInviteEmail` recebe `kind?: "convite" | "boas-vindas"`
      (padrão `"convite"`) e passa `tenantName: params.tenant.name` ao montar o texto de
      boas-vindas — sem função nova

## 3. Ações da tela de Usuários

- [x] 3.1 Em `src/app/admin/(dashboard)/usuarios/actions.ts`, `createUser` e `resendInvite`
      passam `kind: inviteEmailKind(session.user.role ?? "")` a `sendInviteEmail`; nada mais
      muda (mesmo token, mesmo `user.invite` / `user.invite-resend` na auditoria)

## 4. Verificação

- [x] 4.1 Teste e2e em `e2e/admin-users.spec.ts`, bloco novo gated por `SUPERADMIN_SEED_*`
      (mesmo padrão de `admin-login.spec.ts`): superadmin entra em `marinho.localhost`, cria uma
      conta Registrador pela tela de Usuários, vê a confirmação e a conta em "Aguardando 1º
      acesso"; limpa a linha no `afterEach`. Roda no CI, não neste sandbox (escrito e
      tipado; sem `SUPERADMIN_SEED_*` aqui, o bloco pula via `test.skip`)
- [x] 4.2 Conferir manualmente o e-mail de boas-vindas em modo log (sem `POSTMARK_SERVER_TOKEN`):
      criar uma conta como superadmin e ler o texto no console — nome da serventia, Provimento
      213, link de `/admin/redefinir-senha`, nenhuma senha (conferido pelo texto puro de
      `buildAccountEmailText`, que é exatamente o que o log imprime; sem banco aqui para
      passar pela tela)
- [x] 4.3 `pnpm typecheck`, `pnpm lint`, `node --test` (invite.test.ts) e
      `openspec validate convidar-admin-cartorio --strict`
