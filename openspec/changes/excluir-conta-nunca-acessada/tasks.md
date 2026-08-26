## 0. Ordem

- [x] 0.1 Implementar depois de `atualizar-conta-do-painel`: as duas mexem em
  `account-row-actions.tsx`, e é aquela change que introduz o botão "Atualizar" ao lado do qual
  o menu "…" vai ficar. Se esta for primeiro, o merge da outra reescreve o mesmo arquivo.

## 1. Server action `deleteAccount` (`src/app/admin/(dashboard)/usuarios/actions.ts`)

- [x] 1.1 Estender a resolução do alvo para trazer a credencial junto: ou um `findOwnAccount`
  com `leftJoin` em `account` pelo provider `credential` (mesmo join de `listAccounts` em
  `page.tsx`), ou uma consulta irmã ao lado dele. Manter o guard de serventia
  (`eq(userTable.tenantSlug, tenant.slug)`) que todas as actions do arquivo compartilham.
- [x] 1.2 Implementar `deleteAccount`: exige `user.manage`, resolve o alvo com o guard acima,
  e recusa com mensagem própria quando a conta já tem credencial — a checagem roda no momento da
  submissão, não é a mesma leitura que pintou a tela (ver o cenário "aceita o convite enquanto o
  diálogo está aberto" na spec).
- [x] 1.3 Apagar os tokens em aberto antes de apagar a conta, com o mesmo predicado de
  `issueResetTokenWith` (`src/lib/auth-tokens.ts`): `deleteMany` em `verification` por
  `value = target.id` e `identifier starts_with "reset-password:"`. Ordem importa, ver design.md.
- [x] 1.4 Apagar a linha de `user`. Não apagar `session` nem `account` à mão: as duas são
  `onDelete: "cascade"` (`src/db/auth-schema.ts`).
- [x] 1.5 `recordAudit` com `action: "user.delete"`, `targetType: "user"`,
  `targetId: target.id`. Não é opcional: `scripts/check-destructive.mjs` reprova um arquivo com
  `.delete(` que não chame `recordAudit` — "uma DELETE é a única escrita que não deixa nada para
  reconstruir depois".
- [x] 1.6 `revalidatePath(USERS_PATH)` ao final, como as demais actions do arquivo.

## 2. Menu "…" (`src/app/admin/(dashboard)/usuarios/account-row-actions.tsx`)

- [x] 2.1 Não existe componente de menu no repositório (nenhum `role="menu"` em `src/app`).
  Escrever um mínimo, local ao arquivo. **Desvio deliberado**: saiu como *disclosure* (botão com
  `aria-expanded` + `aria-label`, revelando dois botões comuns), não `role="menu"`. O papel de
  menu promete navegação por setas, roving tabindex e typeahead; anunciar um menu que não
  implementa nada disso é pior para um leitor de tela do que um grupo expansível que o Tab já
  percorre. Dois botões não precisam de menu.
- [x] 2.2 Fechar com Escape, com clique fora e ao acionar um item. Foco volta para o botão "…"
  ao fechar. Com uma ressalva que só apareceu escrevendo: enquanto um `ConfirmAction` aberto de
  dentro do popover estiver na tela, Escape e clique-fora são ignorados aqui — o modal está no
  top layer e é dele o Escape, e fechar o popover primeiro desmontaria o diálogo no meio da
  própria pergunta.
- [x] 2.3 Mover "Desativar acesso" de botão visível para item do menu, sem mudar o que a ação
  faz nem o `ConfirmAction` que ela já usa. "Atualizar" e "Nova senha"/"Reenviar convite"
  continuam fora do menu.
- [x] 2.4 "Excluir conta" no menu, em tratamento destrutivo (o mesmo vermelho de token que o
  painel já usa — nenhum hex novo), presente somente quando `active === false`. Na própria linha
  da sessão o menu não oferece nem Desativar nem Excluir.
- [x] 2.5 Diálogo de confirmação com `ConfirmAction`, curto: pergunta "Excluir a conta de
  <nome>?", consequência dizendo que a conta nunca foi acessada e que não dá para desfazer,
  "Excluir" / "Cancelar". Sem digitar o e-mail — ver não-objetivos.
- [x] 2.6 Passar o nome da conta para `AccountRowActions`. **Nada a fazer**:
  `atualizar-conta-do-painel` já trocou as props soltas por um `AccountSummary` com nome e
  e-mail, para o diálogo de Atualizar. O nome já estava lá.
- [x] 2.7 Erro do servidor renderizado dentro do diálogo (`ConfirmAction` já mantém aberto com
  `error`), sucesso como `toast.success("Conta excluída.")`.

## 3. Verificação

- [x] 3.1 Teste (`node --test`, no padrão de `src/db/deactivate-account.test.ts`): excluir conta
  sem credencial apaga `user`, `session` e `account` por cascata, e apaga a linha de
  `verification` do convite.
- [x] 3.2 Teste: excluir conta que tem credencial é recusado e nada é apagado.
- [x] 3.3 Teste: depois de excluir, criar conta com o mesmo e-mail é aceito (o índice único de
  `user.email` está livre).
- [x] 3.4 Teste: abrir o link do convite de uma conta excluída cai na tela de link inválido.
  **Coberto por outro ângulo**: o teste afirma que a linha de `verification` some com a conta, que
  é o que torna o link inválido — o `acceptInvite` nem chega a procurar o usuário. Dirigir a rota
  de verdade é o que o e2e faria, e ele precisaria de um segundo contexto de navegador sem sessão
  só para reconfirmar um `redirect` que já existia antes desta change.
- [x] 3.5 E2E (Playwright): criar conta, excluir pelo menu, conferir que a linha some da lista.
  Escrito; **não executado aqui** — a suíte pede `DATABASE_URL`, `ADMIN_SEED_EMAIL` e
  `ADMIN_SEED_PASSWORD` e a tela fica atrás do login.
- [x] 3.6 Acessibilidade do menu: abrir e navegar só pelo teclado, Escape fecha, foco volta ao
  botão "…". Asserção dentro do e2e da 3.5 (`Enter` abre, `aria-expanded` vira `true`, `Escape`
  fecha, `toBeFocused` no gatilho).
- [x] 3.7 `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm check:tokens`,
  `pnpm check:destructive`.
