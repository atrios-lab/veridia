## 1. Dados

- [x] 1.1 Adicionar coluna nullable `disabledAt: timestamp("disabled_at")` em `user`
  (`src/db/auth-schema.ts`).
- [x] 1.2 Gerar e revisar a migração com `pnpm db:generate` (aditiva, sem passo destrutivo).

## 2. Núcleo (src/core/auth)

- [x] 2.1 Adicionar em `src/core/auth/roles.ts` (ou módulo equivalente de contas) a checagem
  pura "última conta Registrador ativa": dado o papel da conta-alvo e a contagem de outras
  contas Registrador ativas na serventia, retorna se a desativação é permitida.

## 3. Server actions (`src/app/admin/(dashboard)/usuarios/actions.ts`)

- [x] 3.1 Implementar `deactivateAccount`: exige `user.manage`, resolve a conta-alvo via
  `findOwnAccount` (mesmo guard de serventia já usado por `resendInvite`/
  `triggerPasswordReset`), recusa se `userId` for o da própria sessão, recusa se a conta for
  Registrador e for a última ativa (usa a checagem da tarefa 2.1), senão grava `disabledAt =
  now()` e apaga as linhas de `session` daquele `userId`.
- [x] 3.2 Implementar `reactivateAccount`: exige `user.manage`, resolve a conta-alvo com o mesmo
  guard, grava `disabledAt = null`.
- [x] 3.3 Gravar `recordAudit` para as duas ações (`user.deactivate`, `user.reactivate`) com o
  mesmo formato usado por `user.invite`/`user.password-reset-request`.
- [x] 3.4 `revalidatePath(USERS_PATH)` ao final de cada ação, como as demais.

## 4. Bloqueio de login/sessão

- [x] 4.1 Em `getSession()` (`src/lib/session.ts`), recusar (retornar `null`) quando
  `session.user.disabledAt` estiver preenchido.

## 5. UI (`/admin/usuarios`)

- [x] 5.1 Em `page.tsx`, incluir `disabledAt` na query de `listAccounts` e derivar o terceiro
  estado do selo ("Acesso desativado"), com prioridade sobre "Ativa"/"Aguardando 1º acesso".
- [x] 5.2 Em `account-row-actions.tsx`, adicionar o botão "Desativar acesso"/"Reativar acesso"
  conforme o estado, seguindo o mesmo padrão de `useActionState` + toast das ações existentes.
- [x] 5.3 Ocultar o botão "Desativar acesso" quando a linha for a da própria conta da sessão
  (comparação já feita em `page.tsx` para o rótulo "(você)").
- [x] 5.4 Pedir confirmação antes de enviar "Desativar acesso" (ação com efeito imediato sobre
  acesso de outra pessoa).

## 6. Testes

- [x] 6.1 Teste de núcleo para a checagem "última conta Registrador ativa" (permite com ≥1 outra
  ativa, recusa com 0, nunca se aplica a Operador).
- [x] 6.2 Teste de integração para `deactivateAccount`: desativa Operador com sucesso; recusa na
  própria conta; recusa na última conta Registrador ativa; sessões da conta-alvo somem.
- [x] 6.3 Teste de integração para `reactivateAccount`: restaura acesso sem alterar a senha
  existente.
- [x] 6.4 Teste cobrindo `getSession()` recusando uma sessão cujo usuário está com
  `disabledAt` preenchido.
