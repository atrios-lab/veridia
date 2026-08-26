## Why

Uma conta criada por engano em `/admin/usuarios` não tem como sair da lista. A única ação
corretiva é "Desativar acesso", que preserva a linha para sempre — e, pior, mantém o e-mail
ocupado: `user.email` é único em toda a plataforma (`src/db/auth-schema.ts`) e `createUser`
recusa qualquer e-mail já cadastrado *em qualquer serventia*. Convidar a pessoa certa na
serventia errada, ou digitar o e-mail errado no convite, queima aquele endereço em definitivo:
não dá para reconvidar no lugar certo, nem para corrigir. A serventia fica com uma linha morta
na lista de contas e um e-mail bloqueado sem prazo.

## What Changes

- Nova ação "Excluir conta", disponível **apenas para conta que nunca acessou** — nenhuma senha
  própria criada, portanto nenhum ato praticado. A exclusão apaga a linha de `user` e libera o
  e-mail para um novo convite.
- A exclusão SHALL apagar também qualquer convite ou link de nova senha ainda em aberto daquela
  conta, que não é apagado por cascata do banco.
- Conta que já acessou continua tendo apenas "Desativar acesso". O botão de excluir não existe
  para ela e o servidor recusa a operação — decisão já tomada em
  `atualizar-conta-do-painel`: `audit_log.actorId` não tem chave estrangeira e todo
  `authorUserId` é `onDelete: "set null"`, então apagar não quebra o banco, mas faz a timeline
  passar a atribuir os atos a "Sistema" e as mensagens a "Serventia". Atribuição de ato é
  justamente o que a trilha existe para guardar.
- Novo menu de overflow "…" na linha da conta, agrupando as ações destrutivas ("Desativar
  acesso" e, quando cabível, "Excluir conta"), conforme o front entregue. "Atualizar" e "Nova
  senha"/"Reenviar convite" continuam visíveis fora do menu.
- Auditoria: cada exclusão grava `user.delete`.

**Não-objetivos**:
- Excluir conta com histórico, mesmo com confirmação forte. O front entregue previa um diálogo
  com "digite o e-mail da conta para confirmar" para esse caso; ele sai de escopo junto com a
  operação que o justificava.
- Anonimizar ou apagar retroativamente os atos de uma pessoa (pedido de titular LGPD sobre conta
  de funcionário é outro fluxo, com outras regras de retenção).
- Exclusão em massa, ou exclusão automática de convite não aceito após N dias.
- Mexer no que "Desativar acesso" faz hoje: ele continua idêntico, só muda de lugar na linha.

## Capabilities

### Modified Capabilities

- `admin-users`: adiciona a ação "Excluir conta" restrita a conta que nunca acessou, com a
  limpeza dos tokens em aberto, e reposiciona as ações destrutivas da linha em um menu de
  overflow.

## Impact

- `src/app/admin/(dashboard)/usuarios/actions.ts`: nova server action `deleteAccount`, com o
  guard de serventia já usado pelas demais (`findOwnAccount`) mais a checagem de "nunca
  acessou"; apaga a linha de `user` e as linhas de `verification` daquela conta.
- `src/app/admin/(dashboard)/usuarios/account-row-actions.tsx`: novo menu "…" e o diálogo de
  confirmação curto; "Desativar acesso" passa de botão para item de menu.
- Sem migração de banco: `session` e `account` já são `onDelete: "cascade"` para `user`.
- `verification` não tem chave estrangeira para `user` (é por design: a tabela é indexada por
  `identifier`, não por usuário), então a limpeza do token é explícita na action.
- Auditoria: um verbo novo gravado (`user.delete`). `src/lib/audit.ts` não muda.
