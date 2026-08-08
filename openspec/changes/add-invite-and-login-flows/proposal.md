## Why

O painel administrativo já autentica quem tem senha (`admin-auth`) e já sabe recusar um convite
vencido, mas ninguém consegue *criar* uma conta pelo painel: a tela de Usuários não existe, e o
único jeito de emitir um convite hoje é um script de terminal (`scripts/invite-admin.ts`) que
imprime o link no console — nenhum e-mail sai de verdade. Sem essa tela e sem envio real de
e-mail, toda serventia continua dependendo de alguém rodar `pnpm db:invite` por fora do produto
para dar acesso a um segundo usuário, e não existe caminho nenhum para trocar a senha de alguém
que esqueceu — o próprio texto do login já promete "o registrador reenvia o convite pela tela
de Usuários", uma tela que ainda não foi construída.

## What Changes

- Adiciona a tela **Usuários** (`/admin/usuarios`, atribuída a `user.manage`, hoje só o papel
  `admin`): lista as contas da serventia com nome, e-mail, papel em português (Registrador/
  Operador) e selo de status (Ativa / Aguardando 1º acesso), e um formulário "Criar conta" que
  pede só nome, e-mail e papel — nunca senha.
- Adiciona **envio real de e-mail transacional**: um módulo de e-mail (novo, a serventia como
  remetente, texto vindo de dados de tenant, nunca hardcoded por cartório) dispara dois modelos
  novos — convite de primeiro acesso e nova senha — reaproveitando o mecanismo de token de 48h
  que `resetPassword` já usa hoje. Em ambiente sem provedor configurado (dev/CI), o envio cai
  para log local, no mesmo espírito do rate limit já existente.
- Adiciona os botões **"Reenviar convite"** (contas em "Aguardando 1º acesso") e **"Nova senha"**
  (contas "Ativa") na lista de Usuários: cada um emite um novo token de 48h pelo mesmo
  mecanismo do convite, invalida qualquer link anterior do mesmo tipo e dispara o e-mail
  correspondente — sem o registrador ver ou definir a senha em nenhum dos dois casos.
  "Nova senha" mantém a conta ativa e a senha atual válida até a nova ser criada.
- Liga a tela de primeiro acesso/nova senha (`/admin/redefinir-senha`, já existe) a uma sidebar
  bloqueada, no lugar do cartão centralizado avulso de hoje: mesma casca do painel, sem itens de
  navegação, com o texto explicando que a senha precisa ser criada para liberar o painel.
- Acrescenta "Usuários" à navegação (`ADMIN_NAV`) agora que a rota existe, atrás de
  `user.manage` — hoje só a sidebar de quem tem esse papel a vê; a rota já checa a permissão
  independente disso.
- Amplia `ADMIN_DESTINATION_LABELS` (usado no aviso de sessão expirada) com as rotas do painel
  que já existem hoje e ainda não têm rótulo (Agenda de atendimentos, Ouvidoria, Requerimentos
  LGPD, Atendimento online, Pedidos de serviço, Publicações, Configurações) e com a nova rota de
  Usuários.

## Não-objetivos

- Troca de senha autoiniciada por quem já está logado ("esqueci minha senha" ou "trocar senha"
  dentro do painel): continua não existindo, por design — `admin-shell` já registra essa decisão
  para o atalho do rodapé.
- Editar ou desativar/excluir conta existente pela tela de Usuários: fora de escopo desta
  entrega, que cobre criar, reenviar convite e disparar nova senha.
- Qualquer papel além de Operador (`staff`) e Registrador (`admin`): o modelo de papéis não
  muda, só ganha rótulo em português na UI.
- Preferência de idioma ou personalização do texto dos e-mails por serventia: o texto é o mesmo
  modelo para todas, só a identidade visual (selo, nome, subtítulo) varia por tenant, como já
  acontece no login.

## Capabilities

### New Capabilities
- `admin-users`: tela de Usuários — listagem, criação de conta, reenvio de convite e disparo de
  nova senha.
- `transactional-email`: módulo de envio de e-mail transacional (convite de primeiro acesso e
  nova senha), com identidade de serventia e fallback de log em ambiente sem provedor.

### Modified Capabilities
- `admin-auth`: convite e nova senha passam a ser emitidos por ação de UI (não mais só pelo
  script de terminal) e a de fato disparar e-mail; reenviar invalida o token anterior do mesmo
  tipo.
- `admin-shell`: a tela de primeiro acesso/nova senha passa a ser renderizada dentro da casca do
  painel, com sidebar bloqueada em vez do cartão avulso atual; navegação ganha o item Usuários;
  rótulos de destino da sessão expirada cobrem as rotas já existentes.

## Impact

- Código novo: `src/app/admin/usuarios/` (página + server actions), módulo de e-mail (ex.:
  `src/lib/email.ts` + templates), rótulos de papel em português (ex.: `src/core/auth/roles.ts`
  ou vizinho).
- Código alterado: `src/app/admin/_components/nav.ts` (item Usuários), `src/app/admin/login/
  page.tsx` (`ADMIN_DESTINATION_LABELS`), `src/app/admin/redefinir-senha/` (casca com sidebar
  bloqueada), `scripts/invite-admin.ts` (pode virar fino wrapper do novo caminho, ou permanecer
  como está para uso local — decisão em design.md).
- Dependências: um provedor de e-mail transacional (a escolher em design.md) e sua variável de
  ambiente, seguindo o padrão já usado pelo Upstash — ausente em dev/CI, o envio vira log.
- Sem migração de banco destrutiva: o selo "Aguardando 1º acesso" é derivado (ausência de
  credencial de senha), nenhuma coluna nova é necessária.
