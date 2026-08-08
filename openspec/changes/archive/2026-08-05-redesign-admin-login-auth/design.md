# Design: Redesign — Painel admin: Login e autenticação

## Context

O comportamento de segurança do login já existe e funciona: `src/app/admin/actions.ts` tem erro
genérico único (`APIError` → `erro=1`), recusa de sessão de outra serventia (mesma resposta
genérica, sessão encerrada na hora), rate limit via Upstash (`src/lib/rate-limit.ts`, no-op sem
env configurada) e auditoria (`src/lib/audit.ts`). O que falta é tudo em volta: a tela é HTML
sem CSS, sessão expirada não leva de volta a lugar nenhum, sair não avisa nada, e convite de
primeiro acesso não existe.

O painel é estética fixa da plataforma — nunca tematizável por serventia, decisão já tomada em
`redesign-home-and-service-request`. O Tailwind v4 atual (`src/app/globals.css`) só declara
tokens de marca por tenant (`@theme static` com 5 paletas + `@theme inline` mapeando
`--color-brand-*`), sob guarda do `scripts/check-tokens.mjs` (hex só dentro de `@theme`).

Referências vinculantes:

- **Design**: projeto Claude Design `558c4556-caed-4f30-9c6b-648f995805cf`, arquivo
  `Redesign 05 - Admin Login e Autenticação.dc.html` (seções `#1a`–`#1d`). Buscar via
  `DesignSync get_file` quando necessário durante a implementação.
- **Auth**: Better Auth 1.6 (`src/lib/auth.ts`), sessão em banco, tabelas `user`/`session`/
  `account`/`verification` (`src/db/auth-schema.ts`) — `verification` ainda não é usada por
  nenhum fluxo do repositório.

## Goals / Non-Goals

**Goals:**

- As 4 telas do design (`1a` entrar, `1b` erros, `1c` sessão/saída, `1d` convite) implementadas
  fielmente, com a estética fixa do painel (nunca a do tenant).
- Sessão expirada devolve a pessoa para onde estava; saída deixa claro que saiu.
- Convite de primeiro acesso funcional (criar senha a partir de um token válido por 48h, tela de
  vencido), sem tabela nova.

**Non-Goals:** os da proposta (tela de Usuários, envio de e-mail, tema por tenant no admin, 2FA).

## Decisions

### 1. Paleta do admin: bloco `@theme static` próprio, nunca `--color-brand-*`

Os valores do design (`#123c2a`, `#1c5638`, `#f4f3ee`, `#e3dfd4`, `#59635b`, `#e9efea`...)
coincidem numericamente com o tema `verde-dourado` do tenant piloto — é o mockup usando a
serventia real como exemplo, não uma decisão de tematizar o admin. Reaproveitar
`--color-brand-*` acoplaria a aparência do painel à paleta de um tenant específico: mudar o
verde-dourado (configuração de uma serventia) repintaria o login de todas.

Declaro um segundo bloco em `globals.css`, `@theme static` "Admin, fixo, nunca por tenant" com
`--palette-admin-*` (primary, primary-soft, surface, card, border, input-bg, input-border,
muted, faint, on-dark-subtitle, on-dark-muted) mais os dois estados que o admin tem e o site
público não usa com esses tons exatos: erro (`#f3e2dd`/`#8f3b2e`/`#c8705e`/`#fdf6f4`, diferente
do `--palette-alert` público) e aviso âmbar de limite (`#f0e8d4`/`#6e5522`). Um `@theme inline`
ao lado expõe `--color-admin-*` para as utilities (`bg-admin-primary`, `text-admin-muted`...).
Sem `[data-theme]`: é o mesmo valor em toda requisição, então não precisa de seletor condicional.

- Alternativa rejeitada: reaproveitar tokens `--color-brand-*` sob um `[data-theme="admin"]`
  fixo — funcionaria, mas deixaria a leitura do código sugerindo que o admin *é* um tema de
  tenant a mais, o oposto do que o produto decidiu.

### 2. `logos.seal` vira `{ light, dark }`

O padrão já existe para a marca principal (`logos.light`/`logos.dark` = "logo para fundo
claro/escuro"). `logos.seal` hoje é uma string só (usada em favicon e no cabeçalho do site
público, ambos fundo claro). O painel de login usa fundo verde escuro fixo e precisa do selo
branco — sem campo, teria que ou reusar `logos.light` (selo escuro num fundo escuro, ilegível)
ou embutir o caminho do arquivo direto no componente do login (rompe a regra de que a marca
sempre vem da configuração do tenant). Viro `seal` num objeto igual a `logos` no topo, mesmo
nome de chaves — quem já conhece `light`/`dark` no logo principal não aprende nada novo.
`CM-Sublogo-branco.png` já existe em `public/logos/`; `marinho.ts` e `aurora.ts` ganham a
segunda chave. Os dois usos existentes (`layout.tsx` favicon, `(public)/layout.tsx` cabeçalho)
passam a apontar `seal.light` explicitamente.

### 3. Sessão expirada: o middleware existente já resolve a distinção

**Corrigido na implementação.** O plano original criava `hasSessionCookie(headers)` para
distinguir "sessão expirada" de "nunca autenticado". Ao abrir `src/middleware.ts` para checar,
o gate já existe e já faz exatamente esse trabalho: todo request para `/admin/*` (exceto o
próprio `/admin/login`) sem cookie de sessão é redirecionado ali, antes de qualquer layout
rodar. Consequência: quando `(dashboard)/layout.tsx` chega a chamar `getSession()` (a checagem
de banco) e ela devolve `null`, o cookie necessariamente existia — o middleware não teria
deixado passar sem ele. Então o `!session` do layout já significa "havia sessão, e o banco a
recusou" (expirada, revogada, ou de outra serventia), sem precisar reler cookie nenhum.

O middleware ganha só uma linha a mais: encaminha o pathname como header `x-pathname` em todo
request que deixa passar, porque um Server Component não tem outro jeito de ler a rota atual. O
layout lê esse header e monta `next=<path>&motivo=expirada`. A página de login resolve `next`
para um rótulo com um mapa pequeno (`ADMIN_DESTINATION_LABELS`, hoje só precisa do default "o
painel", já que `/admin` é o único destino que existe) — cresce quando o painel ganhar mais
telas (Entrega 6 em diante), sem redesenhar nada aqui.

- Alternativa rejeitada (o plano original): reimplementar a mesma checagem de cookie dentro de
  `src/lib/session.ts` — duplicaria o que o middleware já faz, com o risco extra de os dois
  lugares divergirem sobre o nome/prefixo do cookie no futuro.

### 4. Saída avisada: query param, não confirmação prévia

O `1c` do design não é um "tem certeza que quer sair?" — é a tela de login de volta, com um
aviso verde de sucesso ("Você saiu do painel.") acima do formulário vazio. `signOut()` passa a
redirecionar para `/admin/login?saiu=1` em vez de `/admin/login`. A página de login trata `saiu`
como um terceiro branch, mutuamente exclusivo com `erro`/`motivo`.

### 5. Convite de primeiro acesso reaproveita o reset de senha do Better Auth

Better Auth já tem o primitivo certo: `emailAndPassword.resetPasswordTokenExpiresIn` (token
com expiração configurável, gravado na tabela `verification` que já existe no schema) e o
endpoint `resetPassword`. Construir uma tabela de convite do zero duplicaria esse mecanismo por
uma diferença de rótulo ("convite" vs "redefinição"), não de comportamento — os dois são "um
link com prazo que deixa a pessoa escolher uma senha nova".

**Confirmado na implementação** (lido `node_modules/better-auth/dist/api/routes/password.mjs`,
v1.6.25): `resetPassword` consome o token da tabela `verification` (identificador
`reset-password:<token>`) e cria a conta de credencial se ela ainda não existir, ou atualiza a
senha se já existir — cobre convite (usuário sem senha ainda) e redefinição (usuário trocando)
com o mesmo código, sem exigir senha anterior conhecida. A única exigência é a conta já existir
em `user` antes do link, que já é como o usuário admin nasce hoje (seed).

- `src/lib/auth.ts`: `resetPasswordTokenExpiresIn: 60 * 60 * 48` (48h, o número do design).
- Rota nova `src/app/admin/redefinir-senha/page.tsx`, lendo `?token=` da query. A página lê a
  conta por trás do token direto da tabela `verification` (sem consumir) só para saudar pela
  primeira nome e decidir o branch; a ação de servidor (`redefinir-senha/actions.ts`) chama
  `auth.api.resetPassword({ token, newPassword })` — falha (token inválido/expirado/consumido)
  cai no mesmo branch "Este convite venceu" que a leitura ausente já renderiza. Sucesso segue
  com `auth.api.signInEmail` (o e-mail já foi lido) e o mesmo guard de serventia do login
  normal, porque a senha agora é válida mas o domínio ainda pode ser o errado.
- Emissão do token (o "reenviar convite" que a tela de Usuários fará na Entrega 4): por ora,
  `scripts/invite-admin.ts` (`pnpm db:invite <email>`), que grava o token direto via
  `ctx.internalAdapter.createVerificationValue` — mesmo padrão de `scripts/seed-admin.ts`, que
  já reaproveita esse acesso interno por não haver endpoint público para "criar usuário com
  senha escolhida, sem e-mail". **Achado na implementação:** o endpoint HTTP
  `requestPasswordReset` (o "enviar e-mail de redefinição") exige
  `emailAndPassword.sendResetPassword` configurado, mas só ele — `resetPassword` (consumir o
  token) não depende disso. Como o script nunca chama `requestPasswordReset`, não foi preciso
  configurar `sendResetPassword` nem um stub de e-mail: zero código de envio, exatamente o que
  o não-objetivo pedia. `src/middleware.ts` passa a exentar `/admin/redefinir-senha` do gate de
  cookie (a mesma exceção que já existe para `/admin/login`) — quem abre um convite não tem
  sessão nenhuma ainda, por definição.

### 6. Erros e aviso de limite: só leitura visual, zero mudança de contrato

`erro=1` e `erro=limite` continuam existindo como estão; o redesign troca a marcação, não os
valores nem quando `actions.ts` os produz. O botão do estado de limite fica com `disabled` e o
texto "Aguarde…" — puramente visual, o bloqueio de fato já é o rate limit no servidor.

## Risks / Trade-offs

- [Reset de senha do Better Auth pressupõe conta já existente] → confirmado na implementação
  (ver decisão 5): o usuário convidado precisa existir na tabela `user` antes do link, criado
  por seed hoje. `resetPassword` cria a conta de credencial na hora se ainda não houver uma, o
  que já cobre esse caso sem fallback nenhum.
- [Sem envio de e-mail] → o link do convite/redefinição só existe como texto que
  `scripts/invite-admin.ts` imprime no terminal por ora; gap conhecido, coberto pelos
  não-objetivos, fechado quando um provedor de e-mail entrar (fora desta entrega).
- [Leitura direta da tabela `verification` fora da API pública do Better Auth] → a página de
  convite lê `identifier`/`expiresAt` para decidir o branch e saudar pelo nome antes de chamar
  `resetPassword`; o formato `reset-password:<token>` é um detalhe interno da lib, não a API
  pública. Se uma atualização do Better Auth mudar esse formato, o pior caso é a tela sempre
  cair no branch "convite venceu" (falha segura, não uma falha de segurança) até o código ser
  ajustado — `resetPassword` continua sendo a chamada pública de verdade.
- [Paleta do admin numericamente igual ao verde-dourado] → duplicação intencional, não alias:
  documentado no código para quem for mexer não presumir que é o mesmo token.

## Migration Plan

Nenhuma migração de banco: `verification` já existe (Better Auth a criou desde a fundação),
`logos.seal` é config em código, não coluna. Se o fallback de token dedicado (risco acima) for
necessário, é uma tabela nova, expand-only, sem tocar dado existente.

## Open Questions

Nenhuma pendente — as duas desta seção (API exata do Better Auth, caminho da rota de aceite)
foram resolvidas na implementação: ver decisão 5 e o risco correspondente.
