## 0. Ordem

- [x] 0.1 Implementar depois de `atualizar-conta-do-painel`: esta change transforma em campo o
  e-mail que aquela deixou como subtítulo do diálogo, e reusa a instrumentação de falha de envio
  que ela adiciona. Ordem entre esta e `excluir-conta-nunca-acessada` é indiferente, mas ver 1.3.

## 1. Primitivo do token (`src/lib/auth-tokens.ts`)

- [x] 1.1 Adicionar `CHANGE_EMAIL_PREFIX = "change-email:"` e `issueEmailChangeTokenWith(ctx,
  userId, newEmail)`, irmão de `issueResetTokenWith`: apaga as trocas pendentes daquela conta e
  cria a linha nova com `identifier = "change-email:<token>"` e
  `value = "<userId>|<newEmail>"`. Mesmo `expiresInSeconds` já lido de
  `ctx.options.emailAndPassword?.resetPasswordTokenExpiresIn` — não introduzir um segundo prazo.
- [x] 1.2 Adicionar `parseEmailChangeValue(value)`: corta no **primeiro** `|` e devolve
  `{ userId, email }`, ou `null` se a linha não tiver o formato. Função pura, testável sem banco.
- [x] 1.3 Adicionar `deleteEmailChangesWith(ctx, userId)` (nome curto, mesmo predicado do
  planejado): `deleteMany` por `value starts_with userId` + `identifier starts_with
  "change-email:"`. Chamada acrescentada em `deleteAccount`, que já estava implementado.
- [x] 1.4 Adicionar `buildConfirmEmailUrl(origin, token)` ao lado de `buildResetPasswordUrl`.
- [x] 1.5 Estender `src/lib/auth-tokens.test.ts` (`node --test`, sem banco real, no padrão do
  arquivo): emitir apaga a pendência anterior da mesma conta e **não** apaga o token
  `reset-password:` daquela conta; `parseEmailChangeValue` com e-mail contendo `+` e com valor
  malformado.

## 2. Texto e envio dos e-mails

- [x] 2.1 Em `src/core/auth/invite.ts`, acrescentar os dois casos ao union `AccountEmailInput`:
  `troca-email` (nome do destinatário, endereço novo — o que vai no botão é confirmar a troca) e
  `email-alterado` (aviso ao endereço antigo, sem botão de ação). Manter o módulo puro, sem I/O.
- [x] 2.2 Cobrir os dois textos em `src/core/auth/invite.test.ts`.
- [x] 2.3 Em `src/lib/email/index.ts`, `sendEmailChangeEmail` e `sendEmailChangedNotice`, no mesmo
  formato dos dois envios existentes. Confirmado ao implementar: `renderEmailCardHtml` exige
  `actionUrl` e `EmailText` exige `buttonLabel`, então o aviso leva o botão "Entrar no painel"
  para `/admin/login` no host da serventia, sem mexer no renderizador compartilhado.
- [ ] 2.4 Texto final dos dois e-mails com o UX writer (ver Open Questions do design). Escrevi uma
  primeira versão, coberta por teste em `invite.test.ts`; a revisão continua pendente.

## 3. Pedido de troca (`src/app/admin/(dashboard)/usuarios/actions.ts`)

- [x] 3.1 Em `src/core/auth/account.ts`, acrescentar `email` ao schema de atualização, com a
  mesma mensagem de `CreateAccountSchema`. Trim e lowercase acontecem onde o valor cru é lido,
  como já documentado naquele arquivo.
- [x] 3.2 Em `updateAccount`: quando o e-mail submetido for igual ao atual, seguir sem tocar em
  nada de e-mail (nome e papel são gravados normalmente).
- [x] 3.3 Quando for diferente: checar unicidade com
  `ctx.internalAdapter.findUserByEmail` (mesma checagem plataforma-wide de `createUser`) e
  devolver o erro no campo `email` se já existir.
- [x] 3.4 Emitir o token (1.1), montar a URL (1.4) e enviar ao endereço **novo**. Envio dentro de
  `try/catch` com `console.error("usuarios.email-change", error)`; se falhar, **apagar a
  pendência recém-criada** antes de retornar o erro — a spec exige que uma falha de envio não
  deixe troca pendente.
- [x] 3.5 `recordAudit` com `action: "user.email-change-requested"`, `targetType: "user"`,
  `targetId: target.id`. Não gravar o endereço pretendido na trilha (`recordAudit`: actor, ação,
  alvo e data, nada mais).
- [x] 3.6 Estado de retorno do diálogo distingue "salvo" de "salvo, e falta confirmar o e-mail",
  para a tela poder dizer a segunda coisa.

## 4. Rota de confirmação (`src/app/admin/confirmar-email/`)

- [x] 4.1 `page.tsx` e `actions.ts` no padrão de `src/app/admin/redefinir-senha/` — rota pública,
  fora do grupo `(dashboard)`, sem `getSession`. **Acréscimo não planejado**: a confirmação virou
  um botão, não o carregamento da página. Scanners de link corporativos seguem toda URL de uma
  caixa de entrada, e um deles completaria sozinho justamente o passo que a troca em duas etapas
  existe para exigir de uma pessoa.
- [x] 4.2 Consumir o token: extraído em `find-email-change.ts`, lido pela página e de novo pela
  action (a action não confia no que a página viu). **Acréscimo não planejado**: a busca é escopada
  à serventia que serve a requisição, como `getSession` faz — um token que resolve contra qualquer
  domínio em que seja colado é um buraco entre serventias esperando alguém achar.
- [x] 4.3 Reconferir a unicidade do endereço **agora**, antes do `UPDATE`, e mostrar a tela
  específica de "endereço não está mais disponível" se tiver sido ocupado. Sem isso o `UPDATE`
  estoura no índice único.
- [x] 4.4 Gravar `user.email` (manter `emailVerified: true`) e apagar a linha de `verification`
  consumida.
- [x] 4.5 `recordAudit` com `action: "user.email-changed"`, `actorId` = o próprio usuário (não há
  sessão; mesmo padrão de `acceptInvite`, que usa `row.userId`), `tenantSlug` resolvido pelo host
  via `getTenant()`.
- [x] 4.6 Enviar o aviso ao endereço antigo **depois** de gravar, em `try/catch` com
  `console.error("usuarios.email-changed-notice", error)`. Falha aqui não muda a tela de sucesso.
- [x] 4.7 Não derrubar sessões e não tocar em senha (ver design.md).

## 5. Tela (`src/app/admin/(dashboard)/usuarios/`)

- [x] 5.1 No diálogo "Atualizar conta", o e-mail vira campo, com a nota do front entregue:
  ao mudar, um link de confirmação vai para o endereço novo e o login antigo vale até a
  confirmação.
- [x] 5.2 Erro de unicidade e de formato renderizados junto ao campo, dentro do diálogo.
- [x] 5.3 Ao salvar com troca pedida, o retorno diz que falta confirmar, nomeando o endereço.
- [x] 5.4 Em `page.tsx`, `listAccounts` ganha o `leftJoin` em `verification` pelo prefixo
  `change-email:` daquela conta; a linha exibe o endereço pretendido como pendência, abaixo do
  e-mail atual.

## 6. Verificação

- [x] 6.1 Teste (`node --test`, padrão de `src/db/invite.test.ts`): pedir a troca não altera
  `user.email`; confirmar altera; o e-mail antigo deixa de autenticar e o novo autentica.
- [x] 6.2 Teste: segundo pedido invalida o link do primeiro.
- [x] 6.3 Teste: endereço ocupado entre pedido e confirmação é recusado na confirmação, sem
  violar o índice único e sem alterar a conta.
- [x] 6.4 Teste: emitir nova senha para a conta **não** cancela a troca de e-mail pendente, e
  vice-versa (é o motivo dos prefixos separados).
- [x] 6.5 E2E (Playwright): pedir a troca, conferir a pendência na lista, abrir o link de
  confirmação e conferir que a lista passa a mostrar o endereço novo. Escrito; **não executado
  aqui** — pede `DATABASE_URL`, `ADMIN_SEED_EMAIL` e `ADMIN_SEED_PASSWORD`.
- [x] 6.6 `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm check:tokens`,
  `pnpm check:destructive`.
- [ ] 6.7 Conferir no painel real, pelo host da serventia (não `localhost` puro), que o link de
  confirmação chega com a origem certa. **Não executada**: a tela fica atrás do login e eu não
  entro com senha.
