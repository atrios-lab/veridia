## 1. Núcleo (`src/core/auth`)

- [x] 1.1 Adicionar `UpdateAccountSchema` em `src/core/auth/account.ts`: `name` (string, trim,
  min 1, "Informe o nome.") e `role` (`z.enum(PANEL_ROLES, "Escolha um papel.")`). Sem `email` —
  ver não-objetivos. Manter o comentário existente sobre trim/lowercase valendo só para o e-mail
  de criação.
- [x] 1.2 Cobrir em `src/core/auth/account.test.ts` (`node --test`): nome vazio e só-espaços
  recusados, papel fora de `PANEL_ROLES` recusado, entrada válida aceita.

## 2. Server action `updateAccount` (`src/app/admin/(dashboard)/usuarios/actions.ts`)

- [x] 2.1 Novo estado de retorno para o diálogo, no mesmo formato de `CreateAccountState`
  (`status`/`message`/`fieldErrors`/`values` ecoados), porque o formulário do diálogo tem campos
  a preservar em caso de erro — `AccountActionState` não serve, ele só carrega uma mensagem.
- [x] 2.2 Implementar `updateAccount`: exige `user.manage`, resolve o alvo com `findOwnAccount`
  (mesmo guard de serventia das demais actions), valida com `UpdateAccountSchema`.
- [x] 2.2b Extraído `countOtherActiveAdmins(tenantSlug, exceptId)` e `LAST_ADMIN_MESSAGE`, com
  `deactivateAccount` passando a usá-los: a query e a frase seriam idênticas nas duas actions, e
  duas cópias de uma trava de segurança é uma a mais do que precisa existir. Não estava no plano.
- [x] 2.3 Proteção do último Registrador: quando o papel gravado for diferente de `"admin"` e o
  papel atual do alvo for `"admin"`, contar as outras contas `admin` ativas da serventia (mesma
  query de `deactivateAccount`: `eq(tenantSlug)`, `eq(role,"admin")`, `isNull(disabledAt)`,
  `ne(id, target.id)`) e recusar via `isLastActiveAdmin` com a mensagem já usada lá: "É preciso
  manter ao menos um Registrador com acesso ativo."
- [x] 2.4 Gravar `name` e `role` em `user` e registrar `recordAudit` com `action: "user.update"`,
  `targetType: "user"`, `targetId: target.id`. Não gravar valores antigos nem novos na trilha
  (ver `recordAudit`: actor, ação, alvo e data, nada mais).
- [x] 2.5 `revalidatePath(USERS_PATH)` ao final, como as demais actions do arquivo.

## 3. Diagnóstico e alternativa ao e-mail (mesmo arquivo)

- [x] 3.1 Substituir o `catch {}` de `resendInvite` por `catch (error)` com
  `console.error("usuarios.resend-invite", error)` antes do retorno de erro.
- [x] 3.2 Idem em `triggerPasswordReset` com `console.error("usuarios.password-reset", error)`.
- [x] 3.3 Trocar as duas mensagens de erro: parar de prometer "Tente de novo em instantes" e
  informar que o envio não foi aceito, apontando copiar o link no caso da nova senha. Texto final
  a definir com o UX writer. **Implementado** como `SEND_FAILED_MESSAGE`, uma frase para as duas
  ações: "O provedor de e-mail não aceitou o envio. Copie o link e entregue à pessoa." Revisão do
  UX writer ainda pendente.
- [x] 3.4 Implementar `createPasswordResetLink` (nome trocado: a action emite o link, quem copia
  é o navegador): exige `user.manage`, resolve o alvo com
  `findOwnAccount`, emite o token com `issueResetTokenWith` + `buildResetPasswordUrl`
  (`resolveOrigin(await headers())`), grava `recordAudit` com
  `action: "user.password-reset-link-issued"` — verbo trocado de `-copied` pelo mesmo motivo: o
  servidor não observa a área de transferência — e devolve a URL no estado da action. Nenhum envio
  de e-mail nesse caminho.

## 4. Tela (`src/app/admin/(dashboard)/usuarios/`)

- [x] 4.1 Novo `update-account-dialog.tsx` ("use client"): botão "Atualizar" na linha abrindo um
  `AdminDialog` com `useActionState`, seguindo o padrão de
  `atendimento/[id]/_components/transfer-dialog.tsx` (mesmo `AdminDialog`, mesmo `DIALOG_FOOTER`,
  mesmo fechamento bloqueado enquanto `pending`).
- [x] 4.2 Conteúdo do diálogo conforme o front entregue: título "Atualizar conta", subtítulo
  `nome · e-mail` (e-mail só como identificação, não é campo), campo Nome, select Papel com
  `PANEL_ROLES`, rodapé "Salvar alterações" / "Cancelar".
- [x] 4.3 Nota do papel no diálogo: dizer que a mudança vale imediatamente, **não** "no próximo
  login" — `getSession()` lê o banco a cada requisição (ver design.md). A frase do mockup está
  errada quanto ao comportamento do sistema.
- [x] 4.4 Erros do servidor dentro do diálogo (o modal cobre qualquer toast), sucesso como
  `toast.success` + fechar, no mesmo padrão de `ConfirmAction`/`TransferDialog`.
- [x] 4.5 Em `account-row-actions.tsx`, colocar "Atualizar" antes de "Nova senha"/"Reenviar
  convite", como no front. Manter "Desativar acesso" como botão visível: o menu "…" entra na
  change de exclusão (ver design.md).
- [x] 4.6 Fluxo de copiar link: expor a alternativa junto ao resultado de "Nova senha" (não como
  botão permanente na linha), com `navigator.clipboard.writeText` e confirmação visível de que
  copiou. A URL nunca aparece em `href` de link nem em query string de navegação.
- [x] 4.7 Não esconder "Atualizar" na própria linha da sessão: corrigir o próprio nome é
  legítimo, e o rebaixamento já é barrado no servidor pela tarefa 2.3.

## 5. Verificação

- [x] 5.1 Teste de núcleo coberto em 1.2. A regra de rebaixamento já estava coberta em
  `roles.test.ts:121` (`isLastActiveAdmin("admin", 0)`) pela change de desativação — é literalmente
  o mesmo predicado, nada a acrescentar.
- [x] 5.2 E2E (Playwright): renomear uma conta e conferir que a lista passa a exibir o nome novo.
  **Coberto pela metade**: a parte da timeline de um pedido antigo ficou de fora — exigiria montar
  um pedido com aquele operador como autor, fixture que a suíte de Usuários não tem. A propagação
  em si é o `leftJoin` ao vivo de `service-request.ts:674`, não há caminho de código novo para
  regredir.
- [x] 5.3 E2E: rebaixar o único Registrador é recusado com a mensagem esperada e nada é gravado.
- [x] 5.4 `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm check:tokens` (nenhum hex fora de
  `@theme` no diálogo novo).
- [ ] 5.5 Conferir no painel real, pelo host da serventia (não `localhost` puro), que o papel
  alterado vale sem novo login. **Não executada**: a tela fica atrás do login e eu não entro com
  senha. O servidor de dev subiu, `/admin/usuarios` compilou sem erro e redirecionou para o login,
  que é o limite do que dá para verificar daqui.
