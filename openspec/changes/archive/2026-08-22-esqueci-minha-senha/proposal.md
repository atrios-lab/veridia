## Why

Quem perde a senha do painel hoje depende de outra pessoa. `sendPasswordResetEmail` existe, mas só é disparado por um registrador na tela de Usuários (`triggerPasswordReset`); o rodapé do login manda "fale com quem responde pela serventia". Numa serventia pequena, com um registrador e uma escrevente, isso significa que o registrador trancado fora do painel numa sexta à noite fica trancado até alguém com `user.manage` aparecer. Todas as peças do fluxo já existem: token, e-mail, tela de definir senha. Falta a ponta que a pessoa aciona sozinha.

## What Changes

- Nova tela pública `/admin/esqueci-senha`: um campo de e-mail, ligada a partir do rodapé do login.
- A tela SHALL sempre responder a mesma coisa, exista a conta ou não, na mesma postura do login ("E-mail ou senha inválidos" para todos os casos): um formulário de recuperação que confirma endereços é uma lista de contas válidas.
- Conta desativada (`disabledAt`) e conta de outra serventia não recebem link, e a pessoa vê a mesma resposta neutra.
- Reuso integral de `issueResetTokenWith` + `buildResetPasswordUrl` + `sendPasswordResetEmail`: nenhum token, e-mail ou tela nova de definição de senha.
- Limite de tentativas pelo `isRateLimited` que o login já usa.
- Auditoria com verbo próprio (`user.password-reset-self-request`), para separar no log o pedido que a pessoa fez do que um registrador fez por ela.
- A tela de convite vencido passa a apontar para o novo fluxo em vez de mandar procurar o registrador.

## Capabilities

### New Capabilities

Nenhuma — é fluxo de autenticação do painel.

### Modified Capabilities

- `admin-auth`: novo requisito de pedido de nova senha pelo próprio usuário; "Convite de primeiro acesso vencido" passa a oferecer o caminho de recuperação.

## Impact

- `src/app/admin/esqueci-senha/page.tsx` e `actions.ts` — tela e server action novas.
- `src/lib/auth-tokens.ts` — recebe `resolveOrigin`, hoje privado dentro de `usuarios/actions.ts`, para os dois chamadores usarem o mesmo.
- `src/app/admin/(dashboard)/usuarios/actions.ts` — passa a importar `resolveOrigin` em vez de declarar.
- `src/app/admin/login/page.tsx` — rodapé com link para o novo fluxo.
- `src/app/admin/redefinir-senha/page.tsx` — tela de link vencido aponta para o novo fluxo.
- Nenhuma mudança em `src/lib/auth.ts`, no transporte de e-mail ou no schema.
