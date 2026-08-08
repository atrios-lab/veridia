## Context

`admin-auth` já sabe validar um token de 48h e criar a senha a partir dele
(`/admin/redefinir-senha`), e já sabe recusar um token vencido. O que falta é tudo que existe
*antes* desse ponto: uma tela para criar a conta e emitir o token, e um jeito de o token virar
e-mail de verdade em vez de linha de console. Hoje isso é `scripts/invite-admin.ts`, rodado por
alguém com acesso ao Neon — não pelo registrador, não pelo painel.

Duas peças novas, uma tela (`admin-users`) e um módulo de envio (`transactional-email`), mais
ajustes pontuais nas duas capabilities existentes que elas encostam (`admin-auth`,
`admin-shell`).

## Goals / Non-Goals

**Goals:**
- Registrador cria conta, reenvia convite e dispara nova senha, tudo pela tela de Usuários, sem
  nunca ver ou definir a senha de outra pessoa.
- Convidado recebe e-mail de verdade, na identidade da serventia, e cria a própria senha pelo
  fluxo que já existe.
- Reenviar (convite ou nova senha) invalida o link anterior do mesmo tipo — nunca dois links
  válidos ao mesmo tempo para a mesma pessoa.
- Ambiente sem provedor de e-mail configurado (dev/CI) continua funcional: o envio vira log,
  mesmo padrão do rate limit com Upstash ausente.

**Non-Goals:**
- Domínio de e-mail próprio por serventia (SPF/DKIM por tenant). Ver decisão abaixo.
- Editar papel ou desativar conta pela tela de Usuários.
- Textos de e-mail configuráveis por serventia além de selo, nome e subtítulo.

## Decisions

### Como a tela de Usuários sabe se a conta está "Aguardando 1º acesso"

Sem coluna nova. A tabela `account` do Better Auth já guarda a senha do provedor `credential`
(`account.password`); uma conta sem essa linha nunca completou o primeiro acesso. A consulta que
lista Usuários faz um `left join` em `account` filtrado por `providerId = "credential"` e usa a
ausência da linha como o selo "Aguardando 1º acesso" — presença vira "Ativa". A mesma checagem
decide, em `/admin/redefinir-senha`, se a tela mostra a saudação de boas-vindas do convite ("Você
entrou pelo link do convite...") ou a confirmação de nova senha ("Senha trocada. Abrindo o
painel..."): primeiro acesso é ausência de `account.password` *antes* da troca, o resto é reset.

Alternativa descartada: coluna `firstAccessAt` ou enum de status em `user`. Rejeitada porque
duplicaria um estado que a tabela `account` já expressa com precisão, e toda escrita nova teria
que manter as duas em sincronia.

### Convite e nova senha reaproveitam o mesmo primitivo

Ambos continuam sendo um token de 48h gravado em `verification` com
`identifier = "reset-password:<token>"` e `value = userId`, exatamente como
`scripts/invite-admin.ts` já faz hoje via `ctx.internalAdapter.createVerificationValue` e como
`resetPassword` já consome em `/admin/redefinir-senha/actions.ts`. "Criar conta" e "Nova senha"
chamam a mesma função interna de emissão de token; só o e-mail disparado em seguida muda de
modelo. Isso é o que já torna verdadeira a história "mesma tela do convite" (US-18): não há duas
implementações de redefinição de senha, uma.

**Invalidar o link anterior ao reenviar**: antes de criar o novo token, apaga de `verification`
toda linha com `value = userId` e `identifier` começando com `"reset-password:"`. Sem esse passo,
o link antigo (ainda dentro das 48h) continuaria válido ao lado do novo — o oposto do que US-08 e
US-16 pedem.

### Onde a lógica pura vive

`src/core/auth/invite.ts` (novo, sem I/O): decide o conteúdo do e-mail como dado estruturado —
`{ kind: "convite" | "nova-senha", recipientName, actionUrl, tenant }` — e formata o texto em
português a partir disso. `src/lib/email/` (novo) é o transporte: renderiza esse dado em HTML
(inline styles, como o e-mail do mockup) e chama o provedor. A separação é a mesma que
`src/core/auth/roles.ts` já estabelece para autorização: regra em `core`, biblioteca descartável
em `lib`.

### Provedor de e-mail: Resend, com fallback de log

Escolhido por ser HTTP simples (sem SMTP, sem socket persistente — compatível com functions
serverless da Vercel, onde este projeto já roda) e por exigir só uma variável de ambiente
(`RESEND_API_KEY`) no mesmo espírito de `UPSTASH_REDIS_REST_URL`/`TOKEN`. Sem a variável (dev,
CI, preview sem segredo), `src/lib/email/send.ts` registra o e-mail via `console.log` em vez de
chamar a API — mesmo padrão de `isRateLimited` retornando sempre `false` sem Upstash configurado.
Alternativas consideradas: **Nodemailer + SMTP genérico** (mais configuração por ambiente, exige
credencial de SMTP por serventia ou um relay compartilhado; rejeitado por trazer mais estado para
gerenciar sem ganho para este escopo); **AWS SES** (exige verificação de domínio e conta AWS que
o projeto não tem hoje; adiado).

**Remetente único da plataforma, não por serventia.** O mockup mostra
`nao-responda@cartoriomarinho.example` como remetente, mas isso exigiria verificar SPF/DKIM do
domínio de *cada* serventia no provedor de e-mail — trabalho de infraestrutura por tenant que
esta entrega não cobre (ver Não-objetivos). O remetente real é um endereço único e verificado da
plataforma (ex.: `nao-responda@notificacoes.<domínio-da-plataforma>`), com o **nome de exibição**
trocando por serventia (`"Cartório Marinho" <nao-responda@notificacoes...>`) — o que a pessoa vê
na caixa de entrada já muda por tenant, só o domínio técnico não. Selo, nome e subtítulo no corpo
do e-mail continuam vindo do `Tenant` resolvido, como já acontece no `/admin/login`.

### Sidebar bloqueada em `/admin/redefinir-senha`

Hoje essa rota renderiza um cartão centralizado avulso, fora da casca do painel (ver
`admin-shell`, que documenta essa rota como exceção explícita ao rodapé "Trocar senha"). Esta
entrega troca isso por uma variante da mesma casca (`Sidebar` + cabeçalho) sem nenhum item de
navegação: só selo, nome da serventia, o texto "Crie sua senha para liberar o painel." (ou "Crie
sua nova senha para voltar ao painel." no caso de reset) e o rodapé com iniciais/nome/"Sair". A
rota continua fora do guard de sessão do middleware (não muda: quem está aqui não tem sessão
ainda, por definição) — o que muda é só a apresentação, reaproveitando o componente `Sidebar` já
existente com uma lista de navegação vazia em vez de reimplementar a casca.

### Rótulos de papel em português

`role: "admin" | "staff"` no banco não muda. Um mapa `ROLE_LABELS` novo (parecido com
`ADMIN_DESTINATION_LABELS` em `login/page.tsx`) traduz para exibição: `admin` → "Registrador",
`staff` → "Operador". Vive perto de `src/core/auth/roles.ts`, mas como constante de
apresentação, não como parte da lógica pura de autorização (que não sabe português).

## Risks / Trade-offs

- [Remetente de plataforma em vez de domínio próprio pode cair em spam com mais facilidade que um
  remetente do domínio da serventia] → Aceitável para esta entrega; documentado como não-objetivo
  explícito, revisitável quando houver mais de uma serventia dependendo disso de verdade.
- [Apagar todas as linhas `reset-password:*` de um usuário ao reenviar também derruba um token
  que a própria pessoa tenha acabado de gerar por outro caminho, se algum dia existir mais de
  um caminho de emissão] → Hoje só existe um caminho (convite ou nova senha, nunca os dois ao
  mesmo tempo para o mesmo estado de conta), então não há colisão possível; registrar a limitação
  aqui para quando isso deixar de ser verdade.
- [Ausência de rate limit no "Reenviar convite"/"Nova senha" (diferente do login, que já tem)]
  → Ambos exigem sessão de `user.manage` para acionar; o risco é abuso por um registrador já
  autenticado, não anônimo — aceito, mas sinalizado em tasks.md como algo a decidir se vira
  problema real.

## Migration Plan

Sem migração de schema. Deploy único: capabilities novas e alteradas sobem juntas; nenhuma tela
existente muda de contrato observável fora do que os specs descrevem (a rota
`/admin/redefinir-senha` muda de casca visual, não de comportamento).

## Open Questions

- Confirmar com quem decide infraestrutura se Resend é aceitável (conta, billing) antes de
  `tasks.md` assumir a variável `RESEND_API_KEY` como certa.
- `scripts/invite-admin.ts` fica como atalho de terminal (útil para seed/dev) ou é removido em
  favor exclusivo da tela? Proposta: manter, apontando no comentário para a tela nova como
  caminho principal — decisão de baixo custo, não bloqueia implementação.
