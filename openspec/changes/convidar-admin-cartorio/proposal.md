## Why

A Átrios já consegue entrar no painel de qualquer serventia como `superadmin` e a tela de
Usuários já cria contas e dispara convite por e-mail, mas o convite que sai é o mesmo de um
Operador convidado pelo Registrador: "Fulano criou uma conta para você". Para o administrador de
um cartório que está entrando na plataforma, esse é o primeiro contato com o produto, e ele chega
sem boas-vindas, sem dizer o que é a plataforma nem por que ela importa para o enquadramento da
serventia no Provimento CN-CNJ n. 213/2026 (padrões mínimos de tecnologia e segurança das
serventias, que proíbe senha compartilhada e exige trilha e proteção de dados). Hoje o onboarding
de cada cartório depende de alguém explicar isso por fora, por telefone ou WhatsApp.

## What Changes

- Quando quem cria a conta (ou reenvia o convite) é um `superadmin`, o e-mail enviado passa a
  ser o **e-mail de boas-vindas da plataforma**, em vez do convite comum: dá as boas-vindas em
  nome da serventia, explica em um parágrafo como o painel ajuda a serventia a se enquadrar no
  Provimento 213 e na LGPD (conta individual por colaborador, auditoria de toda ação, canais de
  ouvidoria e de direitos do titular já no site) e traz o link de primeiro acesso.
- O link de primeiro acesso é o **acesso temporário** do administrador: vale 48 horas, funciona
  uma vez e obriga a criação da senha antes de liberar o painel. É o mesmo token e a mesma tela
  (`/admin/redefinir-senha`) que o convite comum já usa; nenhuma senha viaja no e-mail.
- Quando quem convida é um Registrador da própria serventia, nada muda: continua saindo o convite
  comum de hoje.

## Capabilities

### New Capabilities

(nenhuma)

### Modified Capabilities

- `transactional-email`: novo requisito — convite emitido por `superadmin` sai como e-mail de
  boas-vindas da plataforma (texto próprio, mesmo link de primeiro acesso). A capability ainda
  vive só como delta em `add-invite-and-login-flows` (não sincronizada em `openspec/specs/`);
  este change acrescenta um requisito `ADDED` a ela.

## Impact

- `src/core/auth/invite.ts` (+ `invite.test.ts`): novo `kind: "boas-vindas"` com o texto do
  e-mail; helper puro que decide o `kind` do convite a partir do papel de quem convida.
- `src/lib/email/index.ts`: `sendInviteEmail` recebe o `kind` (padrão `"convite"`) e o nome da
  serventia, para o assunto e o corpo das boas-vindas.
- `src/app/admin/(dashboard)/usuarios/actions.ts`: `createUser` e `resendInvite` passam o `kind`
  derivado de `session.user.role`.
- `e2e/admin-users.spec.ts`: superadmin cria uma conta pela tela de Usuários de uma serventia.
- Sem migração de banco, sem variável de ambiente nova, sem tela nova, sem verbo novo de
  auditoria: `user.invite` já registra o ator, e o ator é o superadmin.

## Não-objetivos

- **Senha temporária em texto no e-mail.** O pedido original fala em "senha temporária que ele
  deve mudar no primeiro acesso"; o link de 48 horas cumpre exatamente esse papel (credencial
  provisória, uso único, obriga a criar a senha antes de entrar) sem mandar senha por e-mail,
  que é o que o Provimento 213 e a spec de `admin-users` ("nunca senha") vetam. Se ainda assim
  for exigida uma senha em texto, é um change à parte.
- Tela ou área da plataforma para "cadastrar cartório" ou listar convites entre serventias: o
  superadmin continua operando o painel de cada serventia pelo domínio dela, como
  `add-atrios-super-admin` decidiu. Registrar a serventia (config em `src/core/tenant`) segue
  sendo passo de código e deploy, anterior ao convite.
- Texto do e-mail configurável por serventia, ou seleção manual do modelo de e-mail na tela de
  Usuários: o modelo é decidido pelo papel de quem convida.
- Forçar troca de senha periódica ou MFA no primeiro acesso: fora deste change.
