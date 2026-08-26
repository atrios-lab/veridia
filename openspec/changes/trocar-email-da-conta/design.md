## Context

O e-mail da conta é três coisas ao mesmo tempo: o login (`emailAndPassword` do Better Auth), a
chave única da plataforma (`user.email.notNull().unique()`, e `createUser` recusa qualquer
endereço já cadastrado *em qualquer serventia*) e o endereço para onde vai todo link de
recuperação. Trocá-lo sem confirmação é a operação que, errada, custa a conta.

O que já existe e vai ser reusado:

- `verification` guarda `identifier` + `value` + `expiresAt`, sem chave estrangeira para `user`.
  É onde o convite e o link de nova senha vivem, com o prefixo `reset-password:` e
  `value = userId` (`src/lib/auth-tokens.ts`).
- `issueResetTokenWith` apaga os tokens anteriores da conta antes de emitir o novo, garantindo
  que só um link fique vivo por vez.
- `resolveOrigin` + `buildResetPasswordUrl` montam a URL do link no host da serventia.
- `/admin/redefinir-senha` é o modelo de rota pública que consome um token: lê a linha de
  `verification`, resolve a conta, aplica e trata o link inválido com uma tela própria.

`atualizar-conta-do-painel` já entrega o diálogo "Atualizar conta" com nome e papel, e mostra o
e-mail no subtítulo como identificação. Esta change transforma esse subtítulo em campo.

## Goals / Non-Goals

**Goals:**
- Trocar o e-mail/login de uma conta sem risco de perder a conta por erro de digitação.
- Manter o acesso pelo e-mail antigo funcionando até a troca ser confirmada.
- Não deixar duas contas com o mesmo e-mail, nem sob concorrência.
- Deixar visível que existe uma troca em curso.

**Non-Goals:**
- Cancelar troca pendente por botão.
- Confirmação no endereço antigo.
- Autoatendimento do próprio e-mail.
- Histórico de endereços anteriores.

## Decisions

**Não usar o `changeEmail` do Better Auth.** A biblioteca tem o recurso, e a regra da casa é
preferir o que já está instalado — mas ele resolve outro problema: opera sobre o usuário *da
sessão* (aqui quem pede é o registrador, agindo sobre a conta de outra pessoa) e envia a
verificação para o endereço *atual* da conta (aqui o ponto inteiro é verificar o endereço
**novo**, porque é o endereço novo que pode estar errado). Adaptá-lo custaria mais do que
escrever o segundo primitivo ao lado do primeiro, que já resolve exatamente esta forma de
problema neste código.

**Token próprio, prefixo próprio, mesma tabela.** `verification` ganha linhas com
`identifier = "change-email:<token>"`. Prefixo distinto de `reset-password:` porque os dois
predicados de limpeza precisam continuar independentes: emitir uma nova senha não pode cancelar
uma troca de e-mail pendente, nem o contrário.

**O `value` carrega `userId` e o e-mail pretendido, nessa ordem, separados por `|`.** Um token de
troca precisa de dois dados; `value` é uma coluna de texto só. Formato:
`"<userId>|<novo-email>"`. A ordem não é estética: o adapter só oferece os operadores `eq` e
`starts_with`, e com o `userId` na frente um único `deleteMany` por
`value starts_with userId` + `identifier starts_with "change-email:"` apaga todas as trocas
pendentes daquela conta — que é o que "pedir outra troca invalida a anterior" precisa, e o que a
exclusão de conta vai precisar também. Com JSON, ou com o e-mail na frente, seria uma varredura.
O separador é `|` porque não pode aparecer em endereço de e-mail válido; a leitura corta no
primeiro `|`.

**A unicidade é conferida duas vezes, e a segunda é a que vale.** No pedido, para dar erro no
campo enquanto o registrador ainda está olhando para o formulário. Na confirmação, porque entre
pedir e confirmar cabem 48 horas, e nada impede que o endereço pretendido tenha sido usado em
outro convite nesse meio-tempo — inclusive em outra serventia, já que o índice é da plataforma.
Sem a segunda checagem o `UPDATE` estouraria no índice único do banco, virando erro 500 numa
tela pública em vez de uma explicação. Verificar duas vezes não é redundância: são dois momentos
diferentes com respostas diferentes.

**Confirmar não exige sessão.** Quem abre o link pode ser justamente a pessoa que não consegue
entrar. O link já é a credencial: só chega a quem alcança a caixa do endereço pretendido, que é
exatamente o que se quer provar. Mesma postura de `/admin/redefinir-senha`.

**A troca não derruba sessão nenhuma.** A sessão é uma linha em `session` com um token próprio;
não depende do e-mail. Quem está logado continua logado, e a senha não muda. Derrubar seria
tratar troca de e-mail como incidente de segurança, e ela não é: quem pediu já tem `user.manage`,
ou seja, já podia desativar a conta e disparar nova senha. Trocar o e-mail não amplia esse poder.

**`emailVerified` continua `true` depois da troca.** As contas nascem com `true`
(`createUser` em `usuarios/actions.ts`), e o endereço novo acabou de ser comprovado pelo próprio
link. Rebaixar para `false` faria a conta ficar em um estado que nada mais no sistema sabe
resolver.

**Aviso ao endereço antigo, best-effort, depois de gravar.** É o único sinal que a pessoa recebe
se a troca não partiu dela. Enviado *após* o `UPDATE`, dentro de `try/catch` com
`console.error("usuarios.email-changed-notice", error)` — a troca já está confirmada e correta,
e falhar o aviso não é motivo para desfazê-la nem para mostrar erro a quem clicou no link.

**O aviso ao endereço antigo leva um botão para o login, não um cartão sem botão.**
`renderEmailCardHtml` exige `actionUrl` e `EmailText` exige `buttonLabel`: todo e-mail do sistema
tem um botão. Tornar os dois opcionais para um único aviso mexeria no renderizador que os cinco
e-mails existentes compartilham, e o aviso tem um destino natural de qualquer forma — a tela de
login da serventia, que é para onde quem estranhar o aviso vai querer ir.

**Sem botão de cancelar pendência.** Pedir outra troca substitui a anterior pelo mesmo
`deleteMany`, e a pendência morre sozinha em 48 horas. Um cancelamento explícito seria uma
action, um botão, um estado e dois testes a mais para encurtar em dois dias um estado que não
afeta o login.

**A pendência aparece na lista, lida da mesma tabela.** `listAccounts` já faz `leftJoin` para
descobrir se a conta tem credencial; ganha um segundo para achar a linha de `change-email:`
daquela conta, e a linha exibe o endereço pretendido. Sem isso a troca fica invisível: o
registrador salva, nada muda na tela, e o único jeito de saber que algo está em curso é a
memória dele.

**Mesmas 48 horas do convite.** O prazo sai da mesma constante já configurada
(`resetPasswordTokenExpiresIn`, `auth.ts:56`). Um segundo prazo seria um segundo número para
explicar na tela e manter em sincronia, sem nenhuma razão para divergir.

## Risks / Trade-offs

- **Quem tem `user.manage` pode mover a conta de um colega para um endereço próprio** →
  Mitigação: aviso ao endereço antigo e dois registros de auditoria (pedido e confirmação). Não é
  escalada de privilégio — o mesmo papel já pode desativar a conta e disparar nova senha —, mas é
  a operação que passa mais despercebida, então é a que precisa deixar rastro.
- **O link de confirmação é um token portador** → Vale 48h, serve para um único endereço já
  escolhido por quem tinha permissão, e não concede acesso: quem o abre não entra no painel, só
  conclui uma troca. Não é substituto de senha.
- **Entre pedir e confirmar, a conta pode ser excluída ou desativada** → A confirmação resolve a
  conta no momento do clique; conta inexistente cai na tela de link inválido, como
  `acceptInvite` já faz. Conta desativada tem a troca aplicada, mas continua sem acesso — o
  estado de acesso é independente do endereço.
- **A troca depende do canal de e-mail, que é o que falhou em produção** → Por isso esta change
  vem depois de `atualizar-conta-do-painel`, que instrumenta a falha de envio e dá a alternativa
  de copiar o link de nova senha. Se o envio da confirmação falhar, o pedido não é gravado como
  pendente e o registrador vê o erro no diálogo.

## Migration Plan

Sem migração de banco: `verification` já existe e a pendência é uma linha nela. Rollback é
reverter o código; as linhas `change-email:` que sobrarem expiram em 48h e não são lidas por
nenhum outro caminho, porque o prefixo é exclusivo desta feature.

## Open Questions

- O texto do e-mail de confirmação e o do aviso ao endereço antigo precisam de revisão do UX
  writer antes de entrar; o esqueleto segue os dois já existentes em `src/core/auth/invite.ts`.
- Se o endereço pretendido já pertence a uma conta **de outra serventia**, a mensagem hoje
  planejada é a mesma de "já existe uma conta com esse e-mail". Confirmar se revelar que o
  endereço está em uso na plataforma é aceitável — é o que `createUser` já faz hoje.
