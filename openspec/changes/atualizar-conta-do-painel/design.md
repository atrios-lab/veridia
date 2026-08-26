## Context

`/admin/usuarios` lista as contas do painel da serventia e hoje oferece criar conta, reenviar
convite, disparar nova senha, desativar e reativar acesso
(`src/app/admin/(dashboard)/usuarios/actions.ts`). Nome, e-mail e papel só são escritos em
`createUser`; depois disso a linha é imutável.

Duas restrições do código atual moldam esta change:

**Nome de usuário não é denormalizado.** A timeline do pedido, a atividade recente e as
mensagens de exigência leem `user.name` por `leftJoin` ao vivo (`src/lib/service-request.ts:674`,
`src/lib/admin-overview.ts:62`), nunca uma cópia gravada no evento. Renomear, portanto,
reescreve também como o passado é exibido, sem migração e sem backfill.

**Sessão é conferida no banco a cada request.** `getSession()` chama `auth.api.getSession`, que
lê a linha de `session` e o `user` correspondente (é o mesmo motivo de `disabledAt` cortar acesso
imediatamente, sem esperar novo login). Papel novo, portanto, vale no clique seguinte.

Do lado do envio de e-mail, `sendEmail` lança quando o Postmark responde não-2xx, incluindo o
corpo da resposta com o `ErrorCode` (`src/lib/email/send.ts`). As duas actions de conta capturam
essa exceção com `catch {}` — o único ponto do repositório que descarta o erro em vez de
`console.error("escopo", error)`.

## Goals / Non-Goals

**Goals:**
- Corrigir nome e papel de uma conta existente, pela tela, sem recriar a conta.
- Impedir, no servidor, que a serventia fique sem nenhum Registrador ativo via rebaixamento.
- Tornar diagnosticável a falha de envio de e-mail das ações de conta.
- Dar à serventia um caminho para devolver acesso que não dependa do provedor de e-mail.

**Non-Goals:**
- Trocar o e-mail (login) da conta.
- Excluir conta.
- Snapshot histórico de nome ("quem era essa pessoa quando o ato foi praticado").
- Tela de autoatendimento do próprio perfil.

## Decisions

**Renomear reescreve o passado exibido, e isso é aceito.** Como o nome é lido por join ao vivo,
depois de renomear "Cartório Marinho" para "Joelison Nascimento" a timeline de maio passa a
dizer "Joelison Nascimento". Aceito porque o caso real que motiva a change é exatamente uma
conta criada com um nome-placeholder que nunca foi o nome de ninguém: congelar esse placeholder
no histórico preserva uma informação errada, não uma informação. Alternativa descartada: gravar
`actorName` em `audit_log` e `authorName` nas mensagens no momento do ato. É a modelagem correta
se um dia a atribuição precisar valer como prova, mas custa duas colunas novas, um backfill e
dois caminhos de leitura — e nada hoje pede isso. Se pedir, a change é aditiva e independente
desta.

**Papel novo vale imediatamente, não no próximo login.** O front entregue diz "Mudar o papel
vale no próximo login"; o comportamento real do sistema é outro, e é o melhor dos dois — a mesma
propriedade que faz "Desativar acesso" derrubar sessão na hora. O texto do diálogo é ajustado
para dizer a verdade, porque prometer "próximo login" faria o operador rebaixado perder botões
na tela sem entender por quê.

**A proteção do último Registrador é a função que já existe.** `isLastActiveAdmin(role,
otherActiveAdminCount)` (`src/core/auth/roles.ts`) recebe o papel *atual* da conta-alvo e a
contagem de outras contas Registrador ativas. Rebaixar é exatamente o mesmo predicado que
desativar: se o alvo é `admin` e não há outro `admin` ativo, recusa. Nenhuma mudança de
assinatura, nenhuma função nova. A contagem reusa a mesma query de `deactivateAccount`
(`ne(userTable.id, target.id)`, `isNull(disabledAt)`).

**E-mail fica fora desta change.** Editar `user.email` pela tela sem confirmação transforma um
erro de digitação em conta perdida, e confirmar exige o que não existe hoje: um segundo tipo de
token (só há o prefixo `reset-password:` em `auth-tokens.ts`), uma rota pública nova, e uma
re-checagem de unicidade no momento da confirmação — o e-mail pretendido pode ter sido tomado
entre pedir e confirmar. Além disso o mecanismo é entregue *por e-mail*, no endereço novo:
construí-lo enquanto o canal de envio está comprovadamente recusando destinatários é construir
às cegas. Por isso o diálogo mostra o e-mail no subtítulo, como identificação, e não como campo.

**"Desativar acesso" continua botão visível; o menu "…" chega com "Excluir conta".** O front
entregue agrupa as ações destrutivas num menu de overflow. Um menu com um item só é um clique a
mais para chegar no mesmo lugar; o segundo item ("Excluir conta") vem na change seguinte, e é
ela que introduz o menu. Desvio deliberado do mockup, com data de validade.

**"Copiar link de nova senha" usa o mesmo primitivo e o mesmo prazo.** `issueResetTokenWith` já
invalida o token anterior a cada emissão e vale 48h (`resetPasswordTokenExpiresIn` em
`auth.ts:56`). Copiar não ganha um TTL próprio: seria um segundo prazo para explicar na tela e
para manter em sincronia, sem nenhum ganho — o link entregue na mão costuma ser usado em
minutos, e o prazo mais curto seria só uma armadilha para quem sai do balcão e usa em casa.
Quanto ao risco: quem copia o link já tem `user.manage`, ou seja, já pode disparar o reset,
desativar a conta e criar outra — ver o link não amplia o poder, só o torna visível. Ainda
assim é auditado com verbo próprio (`user.password-reset-link-issued`), porque a diferença entre
"mandei um link para o e-mail dela" e "peguei o link dela na mão" é exatamente o que uma
auditoria quer conseguir distinguir depois.

**O erro do provedor vai para o log, nunca para a tela.** A resposta do Postmark pode conter o
endereço do destinatário e o motivo da recusa; a tela do registrador recebe uma frase estável, e
`console.error("usuarios.password-reset", error)` leva o `ErrorCode` para o log de produção,
onde o suporte olha. Mesmo par de comportamentos de `pedidos/[protocolo]/actions.ts`.

**A mensagem de falha deixa de mentir.** "Tente de novo em instantes" é falso quando a causa é
supressão de destinatário ou conta do provedor pendente de aprovação — situações permanentes, em
que repetir o clique nunca funciona. A nova frase informa que o envio não foi aceito e aponta o
caminho de copiar o link, que é a saída que não depende do provedor.

## Risks / Trade-offs

- **Renomear apaga o rastro do nome anterior.** Mitigação parcial: a auditoria grava
  `user.update` com actor e alvo, então *que* houve uma alteração fica registrado, ainda que o
  valor anterior não. Gravar o valor anterior contraria a regra de `recordAudit` (actor, ação,
  alvo e data, nada mais).
- **Link copiado é um token portador em texto.** Vai para a área de transferência do
  registrador e sai do controle do sistema. Aceito pelo argumento de poder equivalente acima, e
  limitado pelas 48h e pela invalidação do token anterior a cada emissão.
- **O log só ajuda depois do próximo deploy.** A falha que motivou a change (relatada em
  25/08/2026, conta `Ativa` com e-mail gmail) não deixou rastro nenhum e não é reconstituível a
  partir do que já aconteceu; o diagnóstico depende de reproduzir com o log novo no ar, ou de
  consultar a Activity/Suppressions do Postmark diretamente.
