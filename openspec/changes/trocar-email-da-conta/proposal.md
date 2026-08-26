## Why

O e-mail de uma conta do painel é gravado uma única vez, no convite, e nunca mais muda: não há
tela, ação nem rota que altere `user.email`. Como o e-mail é também o login, um endereço errado
ou desatualizado só tem duas saídas hoje, e as duas são ruins — desativar a conta e criar outra
(perdendo a continuidade da pessoa no painel), ou conviver com uma conta que entra com um
endereço que a serventia não usa mais.

O caso que aparece na prática é o cartório que sai de um endereço genérico de provedor gratuito
para o e-mail do próprio domínio, ou o operador cujo endereço foi digitado errado no convite. A
change `atualizar-conta-do-painel` deixou nome e papel editáveis e o e-mail de fora, justamente
porque trocá-lo sem confirmação transforma um erro de digitação em conta perdida: ninguém mais
consegue entrar, e o link de recuperação vai para um endereço que não existe.

## What Changes

- O campo **E-mail** passa a ser editável no diálogo "Atualizar conta", com o comportamento que o
  front entregue descreve: ao salvar, a conta **continua entrando com o e-mail antigo** até que a
  troca seja confirmada.
- Nova confirmação por link enviado **ao endereço novo**: só quem alcança a caixa de entrada do
  endereço pretendido conclui a troca. Endereço digitado errado nunca chega a valer.
- Nova rota pública `/admin/confirmar-email`, irmã de `/admin/redefinir-senha`: consome o link,
  aplica a troca e informa o resultado. Não exige sessão — quem confirma pode ser justamente
  quem está sem acesso.
- A unicidade do e-mail é verificada **duas vezes**: ao pedir a troca e de novo no momento de
  confirmar, porque o endereço pretendido pode ter sido tomado por outra conta nesse intervalo.
- A lista de contas passa a indicar quando há uma troca de e-mail pendente, com o endereço
  pretendido, para que a troca em curso não fique invisível.
- Pedir uma nova troca para a mesma conta invalida a troca pendente anterior.
- Ao concluir a troca, o sistema avisa o **endereço antigo** de que o e-mail da conta foi
  alterado. Aviso é o único sinal que a pessoa recebe se a troca não partiu dela; falha nesse
  aviso não desfaz nem bloqueia a troca.
- Auditoria: `user.email-change-requested` ao pedir e `user.email-changed` ao confirmar.

**Não-objetivos**:
- Botão de cancelar uma troca pendente. Pedir outra troca substitui a anterior, e a pendência
  expira sozinha em 48 horas; um cancelamento explícito é uma ação a mais para manter e testar,
  para um estado que dura dois dias.
- Confirmação também no endereço antigo (dupla confirmação). O endereço antigo recebe aviso, não
  poder de veto: se a serventia perdeu o acesso à caixa antiga — que é metade dos casos reais —
  exigir confirmação lá tornaria a troca impossível exatamente quando ela é mais necessária.
- Autoatendimento: a troca continua sendo pedida por quem tem `user.manage`.
- Histórico de e-mails anteriores da conta.
- Trocar o e-mail de conta de outra serventia, ou o e-mail institucional da serventia
  (`tenant.emailFrom`), que é configuração como código e não passa por esta tela.

## Capabilities

### Modified Capabilities

- `admin-users`: o e-mail da conta passa a ser alterável pelo diálogo "Atualizar conta", em duas
  etapas (pedido e confirmação no endereço novo), com indicação de troca pendente na lista.

## Impact

- `src/core/auth/account.ts`: o schema de atualização passa a aceitar `email`.
- `src/core/auth/invite.ts`: novo texto de e-mail (`troca-email`) e o texto do aviso ao endereço
  antigo, no mesmo módulo puro dos outros dois.
- `src/lib/auth-tokens.ts`: novo primitivo para o token de troca de e-mail, irmão de
  `issueResetTokenWith`, com prefixo próprio em `verification` e o e-mail pretendido junto do
  `userId`.
- `src/lib/email/index.ts`: dois envios novos (`sendEmailChangeEmail`, `sendEmailChangedNotice`).
- `src/app/admin/(dashboard)/usuarios/actions.ts`: `updateAccount` passa a tratar o e-mail como
  pedido de troca, não como escrita direta.
- `src/app/admin/confirmar-email/`: rota nova (page + action).
- `src/app/admin/(dashboard)/usuarios/page.tsx`: a listagem passa a trazer a troca pendente.
- Sem migração de banco: a pendência vive em `verification`, que já existe.
- Auditoria: dois verbos novos gravados. `src/lib/audit.ts` não muda.
