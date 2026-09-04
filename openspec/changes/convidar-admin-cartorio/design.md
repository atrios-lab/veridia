## Context

Tudo que o fluxo precisa já existe: `superadmin` entra no painel de qualquer serventia pelo
domínio dela (`add-atrios-super-admin`), `/admin/usuarios` cria a conta sem senha, emite o token
de 48h (`issueResetTokenWith`) e dispara `sendInviteEmail`, e `/admin/redefinir-senha` obriga a
criar a senha antes de liberar o painel (`add-invite-and-login-flows`). O que falta é só o
*conteúdo* do primeiro e-mail que o administrador de um cartório recebe: hoje é o convite
genérico de Operador, sem boas-vindas e sem contexto do Provimento 213.

O texto dos e-mails de conta é dado puro em `src/core/auth/invite.ts` (`buildAccountEmailText`,
um `kind` por modelo), renderizado por `src/lib/email/render.ts` e enviado por
`src/lib/email/send.ts` (Postmark, com fallback de log). Um modelo novo é um `kind` novo.

## Goals / Non-Goals

**Goals:**
- O administrador convidado pela Átrios recebe um e-mail de boas-vindas que diz o que é a
  plataforma, como ela ajuda no enquadramento ao Provimento 213 e à LGPD, e por onde entrar.
- Nenhuma senha viaja por e-mail; o link de 48h é a credencial provisória e o primeiro acesso
  exige criar a senha.
- Nenhuma tela, tabela, variável de ambiente ou verbo de auditoria novo.

**Non-Goals:**
- Senha temporária em texto (ver Não-objetivos da proposta).
- Área de plataforma para cadastrar serventias ou acompanhar convites entre elas.
- MFA ou expiração periódica de senha.

## Decisions

### O modelo do e-mail é decidido pelo papel de quem convida

`kind` do convite = `"boas-vindas"` quando `session.user.role === "superadmin"`, `"convite"`
caso contrário. Um helper puro `inviteEmailKind(role)` em `src/core/auth/invite.ts`, chamado por
`createUser` e `resendInvite`, para a regra viver num lugar só e ter teste.

Alternativas descartadas:
- **Derivar do alvo** ("é o primeiro Registrador ativo da serventia"): exigiria a contagem que
  `countOtherActiveAdmins` já faz, mas erra quando a Átrios convida um segundo Registrador (que
  também merece as boas-vindas) e acerta por acaso quando o próprio Registrador cria outro. O
  que distingue o e-mail é *quem fala*: a plataforma dando boas-vindas versus um colega
  liberando acesso.
- **Seletor na tela de Usuários** ("enviar como boas-vindas"): um controle a mais para uma
  decisão que o papel já toma sozinho, e abriria a um Registrador mandar o e-mail da Átrios.

### Mesmo token, mesma tela, sem "senha temporária"

O e-mail leva o link de `buildResetPasswordUrl` como hoje. A tela `/admin/redefinir-senha` já
trata a ausência de credencial como primeiro acesso ("Crie sua senha para liberar o painel.") e
audita `session.first-access`. Isso *é* o "acesso temporário que obriga a trocar no primeiro
uso" da proposta: uso único, 48h, e o painel só abre depois da senha criada.

Gerar uma senha aleatória, gravá-la via Better Auth, marcar `mustChangePassword` e bloquear o
painel até a troca seria uma segunda implementação do mesmo estado, com uma senha em texto num
e-mail — exatamente o que o Provimento 213 chama de má prática e o que a spec de `admin-users`
("nunca senha") já veta. Descartado.

### O texto vive no núcleo puro, com a referência legal fixa

`buildAccountEmailText({ kind: "boas-vindas", recipientName, inviterName, roleLabel,
tenantName })` devolve o `EmailText` de sempre (assunto, parágrafos, botão, rodapé). O nome da
serventia entra no assunto e no primeiro parágrafo, por isso é input novo; selo e subtítulo já
vêm do cabeçalho renderizado. A menção ao "Provimento CN-CNJ n. 213/2026" e à LGPD fica no
texto, como o rodapé do site público já faz (`src/app/(public)/layout.tsx`): é texto da
plataforma, igual para toda serventia, não configuração por tenant.

O parágrafo sobre o enquadramento só afirma o que o produto entrega hoje: conta individual por
colaborador (sem senha compartilhada), trilha de auditoria de cada ação, canais de ouvidoria e
de direitos do titular já no site. Não promete criptografia, MFA nem plano de continuidade.

`inviterName` continua sendo `session.user.name` do superadmin (o nome dado no seed, ex.
"Equipe Átrios"): sem constante nova de nome de plataforma.

### `sendInviteEmail` ganha `kind`, não uma função nova

`sendInviteEmail` recebe `kind?: "convite" | "boas-vindas"` (padrão `"convite"`) e
`tenantName` sai de `params.tenant.name`, que a função já recebe. Uma `sendWelcomeEmail` à parte
seria a quarta cópia do mesmo bloco de sete linhas em `src/lib/email/index.ts`.

## Risks / Trade-offs

- [Superadmin convida um Operador para suporte e ele recebe boas-vindas "de administrador"] →
  o texto usa `roleLabel`, então diz "conta de Operador"; o resto das boas-vindas continua
  verdadeiro. Aceito.
- [Registrador reenvia o convite que a Átrios emitiu e sai o convite comum] → o link é o mesmo
  e o e-mail comum é correto para quem o reenvia; o superadmin pode reenviar ele mesmo se quiser
  as boas-vindas de novo. Aceito.
- [O e-mail de log (sem `POSTMARK_SERVER_TOKEN`) não é observável pelo e2e] → a regra do `kind`
  e o texto têm teste de unidade; o e2e cobre que o superadmin consegue criar a conta pela tela
  de Usuários, que é o caminho que este change libera de fato.

## Migration Plan

Deploy único, sem schema. Fluxo operacional por cartório novo: registrar o tenant em
`src/core/tenant` e fazer deploy → superadmin entra em `<host-da-serventia>/admin/login` →
Usuários → Criar conta (papel Registrador) → o administrador recebe as boas-vindas e cria a
senha pelo link.

## Open Questions

Nenhuma que bloqueie. Se o texto do parágrafo sobre o Provimento precisar de revisão jurídica,
é edição de string em `invite.ts` com o teste correspondente.
