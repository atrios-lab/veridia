## Context

O primitivo de recuperação está pronto e em uso: `issueResetTokenWith(ctx, userId)` emite um token de 48h e apaga o anterior da mesma conta, `buildResetPasswordUrl` monta o link, `sendPasswordResetEmail` manda o card, e `/admin/redefinir-senha` consome o token, grava a senha e já entra. `triggerPasswordReset` na tela de Usuários é hoje o único caminho até esse primitivo, e exige `user.manage`. Este change abre um segundo caminho, sem sessão, com as garantias que um endpoint anônimo exige e o autenticado não precisava.

## Goals / Non-Goals

**Goals:**
- Pessoa com conta ativa na serventia do domínio pede o link sozinha e o recebe.
- O endpoint não diz a ninguém se um e-mail tem conta.
- Nenhum token, e-mail ou tela nova de senha: só a porta de entrada.

**Non-Goals:**
- Trocar a senha estando logado (é outra tela, outro fluxo, ninguém pediu).
- Segundo fator, perguntas de segurança, verificação por SMS.
- Mudar o que `triggerPasswordReset` faz: o caminho do registrador continua igual.

## Decisions

- **Resposta neutra sempre, inclusive no sucesso.** A tela responde "Se existe uma conta com esse e-mail nesta serventia, o link acabou de sair" em todos os casos: e-mail inexistente, conta de outra serventia, conta desativada e envio feito. É a mesma decisão que `signIn` já tomou ("One generic outcome for every failure"), e ela vale mais aqui: o login pelo menos exige uma senha para tentar, este formulário não exige nada. Alternativa considerada: dizer "não encontramos essa conta" para ajudar quem errou o e-mail — rejeitada, é exatamente o que transforma o formulário em oráculo de endereços.
- **Busca escopada por `email` + `tenantSlug` + `disabledAt IS NULL`.** As três condições numa query só. A serventia vem do domínio, como em todo o resto do app. Conta desativada é o caso que mais importa: um ex-funcionário não recupera acesso por um formulário anônimo, e é justamente onde a resposta neutra ganha o seu valor, porque a alternativa seria a tela dizer "essa conta foi desativada".
- **`resolveOrigin` sobe para `src/lib/auth-tokens.ts`**, ao lado de `buildResetPasswordUrl`, que é a função que consome o valor. Hoje ele é privado dentro de `usuarios/actions.ts`; duplicá-lo seria a terceira cópia da mesma regra de protocolo em três lugares. Alternativa: exportar de `usuarios/actions.ts` — rejeitada, um arquivo `"use server"` exporta server actions, não utilitários.
- **Verbo de auditoria próprio: `user.password-reset-self-request`.** O existente (`user.password-reset-request`) carrega `actorId` do registrador; aqui ator e alvo são a mesma pessoa. Distinguir por `actorId === targetId` funcionaria e seria ilegível na tela de auditoria. Nada é auditado quando não há conta: não há id para escrever e o log não deve registrar e-mails digitados por estranhos.
- **Limite de tentativas com `isRateLimited`**, o mesmo balde `veridia:auth` de dez por minuto do login. A resposta ao limite é a única que difere da neutra, porque não vaza nada sobre contas, só sobre o próprio IP.
- **A tela de convite vencido passa a apontar para cá.** Hoje o spec exige "sem opção de reenviar para si mesma", regra que existia porque não havia caminho seguro para isso. Agora há, e manter a tela mandando procurar o registrador seria esconder do usuário uma porta que o login ao lado já mostra.

## Risks / Trade-offs

- [Alguém pede reset no e-mail de um colega e invalida o convite pendente dele] → `issueResetTokenWith` apaga o token anterior por desenho (specs/admin-auth: "Reenvio ou nova senha invalida o token anterior"). O colega recebe um link novo e funcional em vez do antigo, então o pior caso é um e-mail inesperado, não uma conta inacessível. Rate limit segura o volume.
- [Conta convidada que nunca definiu senha usa "esqueci minha senha"] → funciona: `resetPassword` grava a primeira credencial igual. O texto do e-mail diz "nova senha" em vez de "convite", imprecisão aceita para não duplicar template.
- [Resposta neutra confunde quem digitou o e-mail errado] → aceito conscientemente; o texto diz "se existe uma conta com esse e-mail", que é a instrução para conferir o endereço sem confirmar nada.
