# Proposta: Redesign — Painel admin: Login e autenticação (Entrega 5)

## Why

O painel administrativo não tem nenhum estilo — o login é HTML puro, marcado no código como
"No style on purpose". O comportamento de segurança já existe (erro genérico único, limite de
tentativas, guarda por serventia), mas a experiência ao redor dele está incompleta: sessão
expirada não volta para onde a pessoa estava, sair não confirma nada, e não existe convite de
primeiro acesso. O redesign aprovado no Claude Design ("Redesign 05 - Admin Login e
Autenticação", projeto `558c4556-caed-4f30-9c6b-648f995805cf`) é a primeira entrega de UI do
painel e fecha exatamente essas lacunas de comportamento, não só a aparência.

## What Changes

- Login (`/admin/login`) ganha a tela de duas colunas do design: painel institucional verde
  escuro (selo, nome e subtítulo da serventia, texto do que o painel faz) e formulário —
  estética fixa da plataforma, nunca o tema do tenant.
- Erros redesenhados reaproveitando o que já existe no servidor: mensagem genérica única
  (`erro=1`) para senha errada, e-mail inexistente ou conta de outra serventia; mensagem de
  limite de tentativas (`erro=limite`) com aviso âmbar e botão desabilitado "Aguarde…". Nenhuma
  lógica de servidor nova aqui, só a leitura visual que já existe hoje.
- Sessão expirada volta ao lugar certo: a guarda do painel passa a levar `next` no redirect e a
  distinguir "sessão que expirou/foi revogada" de "nunca autenticado" (presença do cookie de
  sessão, mesmo inválida), para mostrar "Sua sessão terminou. Entre de novo para voltar a
  `<destino>`." só quando é o primeiro caso.
- Saída avisada: `signOut` redireciona para o login com "Você saiu do painel." em vez de deixar
  o formulário em branco sem retorno nenhum.
- **Convite de primeiro acesso** (link de 48h para criar senha, e tela de link vencido):
  reaproveita o fluxo de redefinição de senha do Better Auth (token guardado na tabela
  `verification`, que já existe) em vez de uma tabela nova. `emailAndPassword` ganha
  `resetPasswordTokenExpiresIn` de 48h.
- `TenantSchema.logos.seal` passa de string única para `{ light, dark }`, no mesmo padrão que
  `logos.light`/`logos.dark` já usam para a marca principal — o painel de login usa fundo verde
  escuro fixo e precisa do selo branco, que hoje não tem campo próprio.

## Não-objetivos

- Tela de "Usuários" para o registrador emitir e reenviar convites pela interface — é a
  Entrega 4 ("Redesign 04 - Admin Config, Usuários e Senha"), ainda não implementada neste
  repositório. Até lá, o convite nasce por seed/CLI, do mesmo jeito que o usuário admin já
  nasce hoje.
- Envio real de e-mail. O link de convite/redefinição existe como token verificável; entregar
  esse link por e-mail é infraestrutura de envio que este repositório ainda não tem, e fica de
  fora.
- Qualquer estilo no resto do painel além do login — as demais telas (Entrega 6 em diante)
  seguem sem CSS.
- Tema por tenant no admin. O painel é estética fixa da plataforma; decisão já tomada em
  `redesign-home-and-service-request`.
- Segundo fator de autenticação — não está no design nem foi pedido.

## Capabilities

### New Capabilities

- `admin-auth`: comportamento completo de login do painel — tela padrão, erro genérico, limite
  de tentativas, sessão expirada com retorno ao destino, saída avisada e convite de primeiro
  acesso (válido e vencido).

### Modified Capabilities

(nenhuma — `openspec/specs/` ainda não tem specs sincronizadas)

## Impact

- `src/app/admin/login/page.tsx`, `src/app/admin/actions.ts`,
  `src/app/admin/(dashboard)/layout.tsx`: reescritos.
- Rota nova para aceitar o convite/redefinição (nome e caminho exato em `design.md`).
- `src/core/tenant/schema.ts`: `logos.seal` vira `{ light, dark }`; `tenants/marinho.ts` e
  `tenants/aurora.ts` atualizados; os dois arquivos já existem em `public/logos/`.
- `src/lib/auth.ts`: `resetPasswordTokenExpiresIn` de 48h.
- `src/lib/session.ts` (ou helper novo ao lado): distinguir sessão expirada de nunca
  autenticado.
- E2E Playwright: `e2e/admin-login.spec.ts` novo.
- Sem dependência nova — Better Auth já resolve geração e verificação do token.
