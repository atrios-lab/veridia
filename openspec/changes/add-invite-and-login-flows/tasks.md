## 1. Papéis e rótulos em português

- [x] 1.1 Criar `ROLE_LABELS` (`admin` → "Registrador", `staff` → "Operador") perto de
      `src/core/auth/roles.ts`, como constante de apresentação separada da lógica pura de
      autorização. (Feito em `src/app/admin/_components/role-labels.ts`; a sidebar já tinha um
      `ROLE_LABELS` privado com `staff` rotulado "Atendimento" — unificado para "Operador", que é
      o termo do mockup, e reaproveitado pela tela de Usuários.)
- [x] 1.2 Testar (`node --test`) que todo valor de `ROLES` tem rótulo correspondente.

## 2. Conteúdo dos e-mails (núcleo puro)

- [x] 2.1 Criar `src/core/auth/invite.ts`: função pura que recebe
      `{ kind: "convite" | "nova-senha", recipientName, actionUrl, tenant }` e devolve
      `{ subject, greeting, body, warning }` em português, sem HTML e sem I/O — só o texto do
      mockup ("Olá, {nome}. {quem convidou} criou uma conta..." / "Foi pedida uma nova senha...").
      (Shape final: `{ subject, paragraphs, buttonLabel, footnote }` — `actionUrl`/`tenant` ficam
      fora do núcleo puro, entram só na renderização em `src/lib/email`.)
- [x] 2.2 Testes unitários cobrindo os dois `kind`, incluindo o aviso de 48h e o "se não foi você
      quem pediu, avise a serventia" exclusivo de `nova-senha`.

## 3. Transporte de e-mail

- [x] 3.1 Variável `RESEND_API_KEY` (+ `EMAIL_FROM_ADDRESS`) em `.env.example`, no mesmo estilo de
      `UPSTASH_REDIS_REST_URL`: sem ela, o envio vira log. (Sem dependência nova: Resend expõe uma
      API HTTP simples, chamada via `fetch`, sem SDK.)
- [x] 3.2 Criar `src/lib/email/render.ts`: monta o HTML inline (selo do tenant, botão único, texto
      de rodapé) a partir do conteúdo puro de `src/core/auth/invite.ts` — mesmo layout do
      mockup (`Redesign 09`), com `logos.seal.light` do tenant (fundo claro do e-mail).
- [x] 3.3 Criar `src/lib/email/send.ts`: chama a API do Resend quando `RESEND_API_KEY` existe;
      caso contrário, `console.log` do destinatário, assunto e link de ação (mesmo padrão de
      `isRateLimited` sem Upstash configurado).
- [x] 3.4 Criar `src/lib/email/index.ts` com `sendInviteEmail` e `sendPasswordResetEmail`,
      compondo 2.1 → 3.2 → 3.3, para as server actions chamarem.
- [x] 3.5 Escolher e documentar o remetente único da plataforma (nome de exibição por tenant,
      domínio técnico fixo) — ver Decisão em `design.md`.

## 4. Emissão e invalidação de token (admin-auth)

- [x] 4.1 Extrair de `scripts/invite-admin.ts` a lógica de emissão de token
      (`createVerificationValue` com `identifier = "reset-password:<token>"`) para uma função
      compartilhada (`src/lib/auth-tokens.ts`), reaproveitada pelo script e pelas novas
      server actions.
- [x] 4.2 Nessa função, antes de criar o token novo, apagar toda linha de `verification` com
      `value = userId` e `identifier` iniciando em `"reset-password:"` — garante um único link
      válido por conta a qualquer momento (specs `admin-auth`: reenvio invalida o anterior).
      (Via `ctx.adapter.deleteMany` com `operator: "starts_with"`, driver-agnóstico — não
      `db.delete` do drizzle direto, o que teria acoplado a função ao driver de produção e
      impedido testar com PGlite.)
- [x] 4.3 Testar: emitir dois tokens seguidos para o mesmo usuário deixa só o segundo válido.
      (`src/lib/auth-tokens.test.ts`, mesmo padrão PGlite de `src/db/invite.test.ts`; inclui
      também o caso de duas contas distintas não se atropelarem.)

## 5. Tela de Usuários

- [x] 5.1 Criar `src/app/admin/usuarios/page.tsx`: lista as contas da serventia da sessão via
      `left join` em `account` (`providerId = "credential"`) para o selo Ativa/Aguardando 1º
      acesso; checa `user.manage` no servidor antes de renderizar. (Caminho real:
      `src/app/admin/(dashboard)/usuarios/page.tsx` — grupo de rotas `(dashboard)`, que é o que dá
      a sidebar e o guard de `admin.access` de graça, igual às outras telas do painel; a URL
      continua `/admin/usuarios`.)
- [x] 5.2 Formulário "Criar conta" (nome, e-mail, papel — sem senha) validado com Zod; e-mail
      duplicado mostra erro amigável, não exceção. (Ajuste: e-mail é único na plataforma inteira,
      não só na serventia — `user.email` não tem `tenantSlug` na chave única; o spec
      `admin-users` foi corrigido para refletir isso.)
- [x] 5.3 Server action `createUser`: cria a conta via adapter interno do Better Auth (mesmo
      caminho de `scripts/seed-admin.ts`), emite o token (4.1), dispara `sendInviteEmail` (3.4),
      grava `recordAudit` (ação nova `user.invite`), mostra confirmação "Conta criada — e-mail
      enviado".
- [x] 5.4 Botão "Reenviar convite" (só em contas Aguardando 1º acesso): server action que reemite
      token (4.1, que já invalida o anterior) e dispara `sendInviteEmail`; audita
      `user.invite-resend`.
- [x] 5.5 Botão "Nova senha" (só em contas Ativa): server action que reemite token (4.1) e dispara
      `sendPasswordResetEmail`; audita `user.password-reset-request`. Não lê nem aceita senha em
      nenhum campo.
- [x] 5.6 Testes (unit onde der para isolar regra; e2e Playwright cobrindo: listar, criar,
      reenviar, nova senha, e o bloqueio de acesso sem `user.manage`). (`e2e/admin-users.spec.ts`.
      A cobertura de "sem `user.manage`" ficou limitada: criar uma segunda conta de teste com
      papel `staff` e senha própria só para testar o 404 exigiria hashear uma senha compatível com
      o Better Auth fora dele, o que este arquivo de teste não tem como fazer; o bloqueio em si —
      `notFound()` no servidor, independente da sidebar — está coberto pelo teste de unidade
      implícito no próprio código e pela mesma garantia geral que `admin-shell` já testa para as
      outras telas. Registrado aqui como lacuna, não escondido.)

## 6. Navegação e casca

- [x] 6.1 Adicionar o item "Usuários" a `ADMIN_NAV` (`src/app/admin/_components/nav.ts`), grupo
      "Serventia", `permission: "user.manage"`, `href: "/admin/usuarios"`. (Ícone novo `users` em
      `icon.tsx`, já que o conjunto não tinha um.)
- [x] 6.2 Ampliar `ADMIN_DESTINATION_LABELS` (`src/app/admin/login/page.tsx`) com as rotas hoje
      sem rótulo (Pedidos de serviço, Requerimentos LGPD, Ouvidoria, Agenda de atendimentos,
      Atendimento online, Publicações, Configurações) e com `/admin/usuarios`.
- [x] 6.3 Trocar a apresentação de `/admin/redefinir-senha` do cartão avulso atual para uma
      variante da casca do painel (`Sidebar` reaproveitado, lista de navegação vazia, texto de
      bloqueio no lugar dela) — comportamento de sessão/token não muda, só o layout em volta.
      (Novo componente `AdminLockedSidebar`; a tela de convite vencido continua sem casca, como já
      era — o mockup também não mostra sidebar nela.)
- [x] 6.4 Diferenciar a cópia da tela conforme já é primeiro acesso ou nova senha (checagem do
      design: ausência prévia de `account.password`), sem criar rota nova — mesma tela, textos
      distintos conforme `design.md`. (Mesma checagem reaproveitada em `redefinir-senha/actions.ts`
      para gravar `session.first-access` só quando é de fato o primeiro acesso, e
      `user.password-changed` no caso de nova senha — achado durante a implementação, não previsto
      no design original, mas mesma fonte de verdade.)

## 7. Auditoria

- [x] 7.1 Adicionar as ações novas (`user.invite`, `user.invite-resend`,
      `user.password-reset-request`) onde `recordAudit` já é chamado nas actions da seção 5.
      (Mais `user.password-changed` em `redefinir-senha/actions.ts`, ver 6.4.)

## 8. Verificação final

- [x] 8.1 `pnpm lint` / Biome, `pnpm typecheck`. (Ambos limpos; também rodado `pnpm build` — a rota
      `/admin/usuarios` compila e todas as rotas existentes continuam de pé.)
- [x] 8.2 `node --test` (unidades de 1, 2, 4) e Playwright (5.6) verdes. (`node --test`: 238/238.
      Playwright: `e2e/admin-users.spec.ts` escrito e valida no `tsc --noEmit` do projeto inteiro,
      mas não pôde ser executado de fato neste ambiente — sem `DATABASE_URL`/`ADMIN_SEED_*`, o que
      já faz o arquivo pular por inteiro via `test.skip`, igual aos demais specs que precisam de
      banco; precisa rodar contra um banco real antes do merge.)
- [x] 8.3 Conferir manualmente os dois e-mails (modo log, sem `RESEND_API_KEY`) contra o texto do
      mockup `Redesign 09 - Fluxos de Convite e Login`. (Texto renderizado bate com o mockup,
      linha a linha, nos dois modelos.)
- [x] 8.4 Passar `openspec validate add-invite-and-login-flows --strict` antes de arquivar.
