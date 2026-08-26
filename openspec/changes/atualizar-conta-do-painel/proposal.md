## Why

Em `/admin/usuarios` o nome e o papel de uma conta são gravados uma única vez, no convite
(`createUser`), e nunca mais podem ser corrigidos pelo painel: não existe nenhuma tela, ação ou
rota que atualize `user.name` ou `user.role`. Uma conta criada como "Cartório Marinho" continua
assinando os atos com esse nome para sempre, e um operador promovido a registrador precisa de
uma conta nova.

Na mesma tela, "Nova senha" e "Reenviar convite" falham em silêncio: as duas server actions
capturam o erro do provedor de e-mail com um `catch {}` vazio
(`usuarios/actions.ts`), sem `console.error`, ao contrário de todo o resto do repositório
(`pedidos/*`, `email/appointment.ts`, `uploads.ts`). Quando o Postmark recusa um destinatário, o
registrador vê "Tente de novo em instantes" — uma frase falsa para uma recusa permanente — e
ninguém, nem o suporte olhando o log de produção, consegue descobrir o motivo. Sem nenhuma
alternativa ao e-mail, a serventia fica sem caminho para devolver acesso a quem perdeu a senha.

## What Changes

- Nova ação "Atualizar" em cada linha de conta, abrindo um diálogo com **Nome** e **Papel**. O
  e-mail aparece no subtítulo do diálogo, apenas como identificação, sem ser editável.
- Proteção: rebaixar o papel é recusado, no servidor, quando a conta-alvo for a última conta com
  papel Registrador ainda com acesso ativo na serventia — a mesma regra que já protege
  "Desativar acesso".
- Auditoria: cada atualização grava uma entrada `user.update`.
- Diagnóstico: `resendInvite` e `triggerPasswordReset` passam a registrar o erro do provedor com
  `console.error("usuarios.<escopo>", error)`, seguindo a convenção do repositório.
- Mensagem de falha honesta: deixa de prometer "Tente de novo em instantes" e passa a apontar a
  alternativa abaixo.
- Nova ação "Copiar link de nova senha": emite o mesmo token de 48 horas e devolve a URL para o
  registrador entregar à pessoa por outro meio, sem depender do envio de e-mail. Auditada como
  `user.password-reset-link-issued`.

**Não-objetivos**:
- Trocar o e-mail da conta. Exige um segundo tipo de token, uma rota pública nova de confirmação
  e nova checagem de unicidade no momento da confirmação; fica para uma change própria, e é
  melhor depois que o canal de e-mail estiver comprovadamente funcionando.
- Excluir conta. Fica para uma change própria, já com a decisão tomada: **excluir só será
  oferecido para conta que nunca acessou** (nenhum ato praticado); conta com histórico continua
  tendo apenas "Desativar acesso", porque `audit_log.actorId` não tem FK e todo `authorUserId` é
  `onDelete: "set null"` — apagar a conta não quebra nada no banco, mas faz a timeline passar a
  exibir "Sistema" e as mensagens "Serventia" no lugar de quem praticou o ato.
- Menu de overflow "…" agrupando as ações destrutivas: chega junto com "Excluir conta", quando
  houver um segundo item para o menu. Até lá "Desativar acesso" continua botão visível.
- Autoatendimento ("Minha conta"): a atualização é feita por quem tem `user.manage`, inclusive
  sobre a própria conta.
- Atribuir o papel `superadmin`, que continua fora de `PANEL_ROLES` e nunca é aceito do
  formulário.

## Capabilities

### Modified Capabilities

- `admin-users`: adiciona a ação "Atualizar" (nome e papel) com a proteção do último Registrador
  ativo, a ação "Copiar link de nova senha", e torna observável a falha de envio de e-mail das
  ações de convite e nova senha.

## Impact

- `src/core/auth/account.ts`: novo `UpdateAccountSchema` (nome e papel), irmão de
  `CreateAccountSchema`.
- `src/app/admin/(dashboard)/usuarios/actions.ts`: nova server action `updateAccount`; nova
  action `copyPasswordResetLink`; `console.error` nos dois `catch` existentes; nova mensagem de
  erro.
- `src/app/admin/(dashboard)/usuarios/account-row-actions.tsx`: botão "Atualizar", novo diálogo
  de formulário (mesmo padrão de `transfer-dialog.tsx`, sobre `AdminDialog`), e a alternativa de
  copiar link no fluxo de nova senha.
- Auditoria: dois novos verbos gravados (`user.update`,
  `user.password-reset-link-issued`). `src/lib/audit.ts` não muda — `action` é `string`, e as
  ações de conta não aparecem em `ACTIVITY_VERBS`, que só nomeia eventos de pedido/canal.
- Sem migração de banco: `user.name` e `user.role` já existem.
