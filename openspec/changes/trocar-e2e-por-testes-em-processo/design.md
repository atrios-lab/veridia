## Context

Hoje há duas suítes com naturezas opostas:

- `pnpm test` (`node --test`, 63 arquivos, 587 testes, ~9,5 s): núcleo puro em `src/core` e testes
  de banco em `src/db` e `src/lib` contra PGlite, um PostgreSQL em processo que aplica as
  migrações reais de `drizzle/`. Já existe precedente de costura testada assim:
  `src/lib/auth-tokens.test.ts` sobe Better Auth em cima de `drizzle-orm/pglite` e exercita funções
  `...With(ctx)` que recebem a dependência em vez de importar o singleton.
- `pnpm e2e` (Playwright, 25 specs, ~200 testes, 9+ min): `next build`, `next start`, Chromium,
  Postgres de serviço migrado e semeado com duas serventias, um worker só no CI, três timeouts
  alargados e duas tentativas de retry para conviver com `net::ERR_ABORTED`. É o único passo do
  CI que precisa de banco, e o único motivo dos `ADMIN_SEED_*`, `AURORA_ADMIN_*` e do serviço
  `postgres` no workflow.

O hook de pre-push já roda só `typecheck + lint + test` (o comentário do próprio hook explica que
pagar o e2e duas vezes por push era insustentável), mas README e a spec `pre-push-verification`
ainda dizem que o push roda o e2e. E 48 dos `tasks.md` em `openspec/changes/` têm tarefa de
estender um spec Playwright, o que empurra cada change nova para o caminho lento.

Restrições que valem aqui: o runner é `node --test` ("sem Vitest" está no contexto do projeto);
regra de negócio vive em `src/core`; Next, Drizzle e Better Auth são transporte descartável.

## Goals / Non-Goals

**Goals:**
- Uma suíte só, em processo, que roda em segundos, sem browser, sem banco externo e sem segredo,
  e que é o mesmo gate em três lugares: tarefa local, hook de pre-push, CI.
- A costura (`src/lib`, e o que hoje mora em `actions.ts`) testável contra PostgreSQL em memória
  com as migrações reais, no mesmo padrão que `auth-tokens.test.ts` já usa.
- Nenhum comportamento que o e2e provava e que importa (regra, isolamento por tenant,
  integridade) fica sem teste; o que é abandonado fica listado, não esquecido.
- A convenção de tarefas do OpenSpec passa a apontar para o caminho rápido.

**Non-Goals:**
- Trocar o runner, a lib de assert ou o estilo dos testes que já existem.
- Renderizar componentes React em teste. Não entra `@testing-library`, jsdom nem React Testing
  em processo.
- Cobrir aparência, tema, contraste ou navegação de browser.
- Mexer em `pnpm check:a11y` ou em suas duas dependências de Playwright.
- Testar cookies, sessão de browser ou o próprio Better Auth.

## Decisions

### 1. Manter `node --test`, não adotar Vitest

O pedido original cita Vitest como exemplo de "suíte leve". A suíte leve já existe e já é o
runner do projeto: 587 testes em menos de 10 segundos. O que pesa é o browser e o banco externo,
não a sintaxe. Migrar 63 arquivos que passam para outro runner custaria dias e não tiraria um
segundo do gargalo. Alternativa considerada: Vitest com `environment: node`, rejeitada por
contrariar o contexto do projeto ("sem Vitest") sem ganho de velocidade.

### 2. A dependência entra pela porta: `...With(db)` em `src/lib`

Funções de `src/lib` que hoje importam o singleton `db` de `src/db/index.ts` ganham uma variante
que recebe o cliente Drizzle (`fileServiceRequestWith(db, tenant, input)`), e a função exportada
de antes vira um `wrapper` de uma linha que passa o singleton. É o padrão que `auth-tokens.ts`
já segue (`issueResetTokenWith(ctx, ...)`). Em teste, `db` é `drizzle(new PGlite(), { schema })`
de `drizzle-orm/pglite`, com `drizzle/*.sql` aplicado no `before`.

Alternativas consideradas:
- Trocar o singleton por uma fábrica que lê `DATABASE_URL` ou um env `TEST_DB=pglite`. Rejeitada:
  esconde a dependência atrás de variável de ambiente, e `db` vira estado global mutável que um
  teste em paralelo pode disputar com outro.
- Mock de módulo (`node:test` `mock.module`). Rejeitada: mocka o Drizzle inteiro e o teste deixa
  de provar a query de verdade contra o schema de verdade, que é justamente o que interessa.

Isso vale só para a costura. `src/core` continua puro e sem banco.

### 3. Server actions ficam finas e não são testadas em processo

`actions.ts` importa `next/headers`, `redirect`, `revalidatePath`: transporte. O que estiver de
regra dentro de uma action (validação de `FormData`, decisão de estado, montagem do que vai para
o banco e para o e-mail) desce para `src/lib` na forma `...With(db, tenant, session, input)`, e é
isso que se testa. A action fica com: ler headers, resolver tenant e sessão, chamar a `With`,
redirecionar ou revalidar. Testar a action em si exigiria simular o request scope do Next, que
não existe fora do servidor; não vale o custo, e é exatamente o tipo de código que "transporte
descartável" descreve.

### 4. Um resolver de `@/` e a condição `react-server` no script `test`

Módulos de `src/lib` importam por `@/` (alias do `tsconfig`) e alguns declaram `import
"server-only"`. O Node não lê `paths` do tsconfig, e `server-only` lança fora do React Server
(seu `exports` só devolve o módulo vazio sob a condição `react-server`). Solução sem dependência
nova:

- `scripts/test-resolve.mjs`: hook de `node:module` `register()` que reescreve `@/x` para
  `src/x`. Uma dúzia de linhas.
- Script `test` vira `node --conditions=react-server --import ./scripts/test-resolve.mjs --test
  "src/**/*.test.ts"`. A condição já é usada por `capture:seal`, então há precedente de que os
  módulos do Next carregam sob ela.

Alternativa considerada: campo `imports` do `package.json` (`#/*`). Rejeitada: obrigaria trocar
`@/` por `#/` em todo `src/` e no `tsconfig` para o Next enxergar o mesmo prefixo.

**Achado na implementação:** o alias e a condição resolvem `server-only`, mas não `next/headers`,
`next/navigation` nem o `cache` de `react` — esses três só existem sob o bundler do Next
(`next/headers` nem declara `exports` no `package.json`; sob ESM puro, `node --test` pede
extensão explícita e falha). Isso bloqueava qualquer módulo de `src/lib` que importasse
`tenant.ts` mesmo só para pegar uma constante, porque o import puxa o arquivo inteiro, headers()
incluso. A correção: `tenant.ts` foi dividido. `src/lib/office-config.ts`, novo, ficou com o que
já era puro (fuso, `today()`, `officeNow()`, as chaves `OFFICE_*_KEY`) e sem nenhum import de
Next; `tenant.ts` reexporta tudo dali (`export * from "./office-config.ts"`), então os 87 lugares
que importam `getTenant`/`OFFICE_TIME_ZONE`/etc. de `@/lib/tenant.ts` não mudam uma linha.
`service-request.ts`, `appointments.ts`, `chat.ts`, `publications.ts` e `email/appointment.ts`
passam a importar a constante que usam direto de `office-config.ts`, não mais de `tenant.ts`. É a
mesma separação que o projeto já pede para `src/core` (regra sem framework); aqui ela desceu um
degrau, para dentro de `src/lib`, no que já era puro e só morava no arquivo errado.

### 5. Triagem spec a spec, com registro do que se abandona

Antes de apagar cada arquivo de `e2e/`, listar suas asserções e classificar cada uma:

| Classe | Exemplo | Destino |
|---|---|---|
| Regra ou integridade já coberta | tenant isolado, protocolo único, prazo pausado | Nada a fazer; anotar o teste que cobre |
| Regra sem cobertura em processo | pedido duplicado abre diálogo, chave enviada por e-mail | Escrever `*.test.ts` em `src/lib` ou `src/db` |
| Navegação, layout, texto de tela, axe | link ativo na sidebar, título da página, contraste | Abandonar e listar em `design.md` desta change |

A lista do que foi abandonado fica na seção "Registro da triagem" ao fim deste arquivo, preenchida
durante a implementação. Sem isso, o próximo change recria em Playwright um teste que alguém
decidiu deixar cair.

### 6. CI fica sem banco; `pnpm build` continua

Sai do workflow tudo que só o e2e usava: serviço `postgres`, `DATABASE_URL`, `DIRECT_URL`,
`ADMIN_SEED_*`, `AURORA_ADMIN_*`, os dois `db:seed`, `db:migrate`, `playwright install` e `pnpm
e2e`. `pnpm build` fica, com os mesmos valores descartáveis de `BETTER_AUTH_*` e `DEFAULT_TENANT`,
porque é o único passo que valida rota, fronteira server/client e tipagem gerada do Next. Não
entra no hook nem na tarefa local: leva mais de um minuto e quase nunca acusa o que typecheck
não acusou.

### 7. A convenção muda na fonte: `openspec/config.yaml`

Regra nova em `rules.tasks`: cobertura de fluxo é teste em processo em `src/lib` ou `src/db`
contra PGlite; Playwright não é opção de tarefa. A linha da stack no `context` troca "node --test
e Playwright (sem Vitest)" por "node --test com PGlite em processo (sem Vitest, sem Playwright)".
É o que faz o próximo `/opsx:propose` sair certo sem ninguém lembrar.

### 8. Route Handlers ganham a mesma forma `...With`, testados com `Request`/`Response` nativos

Achado na triagem de `e2e/service-request.spec.ts`: parte do que o e2e provava não é regra de
`src/lib`, é comportamento do Route Handler em si (o link assinado do PDF nunca leva a chave no
`Location` do redirect, o `Content-Disposition` certo por tipo de documento, uma chave errada
sempre responde 404 antes de qualquer diferença que revele se o protocolo existe). Isso é
segurança de verdade, não navegação, e não tinha para onde descer: não é `src/core` (depende de
banco) nem cabia como não-objetivo (apagar sem repor seria apagar a prova de que a chave não
vaza).

A saída: o handler exportado (`POST`, `GET`) vira tão fino quanto uma action — resolve `tenant`
via `getTenant()`, lê o `Request`, chama uma função irmã `handle...With(db, tenant, request ou
form, origin)` que faz todo o trabalho e devolve o `Response` pronto. Essa função não chama
`getTenant()` nem `next/headers` em lugar nenhum, e por isso carrega e roda sob `node --test` como
qualquer outra `...With`: um teste monta um `Request`/`FormData` (ambos globais do Node, sem
import), passa o tenant de `TENANTS` e o `db` de `createTestDb()`, e afirma o `Response` (status,
headers, corpo) do jeito que `request.post(...)` fazia no Playwright.

Feito em `src/app/(public)/solicitar/requerimento/route.ts`
(`handleRequerimentoDownloadWith`) e `.../requerimento/[arquivo]/route.ts`
(`handleRequerimentoLinkWith`). O mesmo padrão vale para qualquer outro Route Handler que a
triagem encontrar pela frente com a mesma forma (recebe request, decide por banco, devolve
Response), sem precisar de decisão nova cada vez.

## Risks / Trade-offs

- [Perde-se a prova de que a página renderiza e o formulário posta] → `pnpm build` no CI ainda
  pega erro de compilação e de fronteira server/client; `check:a11y` manual continua disponível
  contra o dev server; e a revisão de tela fica com quem mexeu nela, como já é para aparência.
- [Testes em processo passam e a action está errada] → A action passa a ter uma linha de regra
  por chamada, no máximo; o risco se concentra em "esqueceu de chamar a `With`", que aparece na
  primeira abertura da tela em desenvolvimento.
- [`--conditions=react-server` muda o que `next/*` resolve e algo não carrega no Node] →
  `capture:seal` já roda sob a mesma condição importando `src/app`. Se um módulo específico
  resistir, a `With` dele vai para um arquivo sem import de `next/*`, e a action importa de lá.
- [PGlite diverge do Postgres da Supabase em algum recurso] → Já é o risco aceito pelos 14 testes
  de `src/db`; nenhum divergiu até hoje. Extensões e `pg_cron` não são usados pelo schema.
- [Triagem apaga cobertura sem perceber] → A regra é: nenhum spec sai antes da sua linha na tabela
  de triagem, revisada no PR.
- [Alguém rodava `pnpm e2e` como fumaça antes de deploy] → O caminho passa a ser `pnpm build`
  local mais `pnpm dev` e a tela; o README diz isso.

## Migration Plan

1. Infra de teste primeiro (resolver, condição, `...With` em um módulo piloto com teste): a suíte
   continua verde e o e2e ainda existe.
2. Triagem e reescrita por domínio, um PR por grupo ou um só, apagando cada spec junto do teste
   que o substitui. O e2e continua rodando no CI até o último spec sair.
3. Por último: `playwright.config.ts`, script `e2e`, workflow, README, config do OpenSpec, spec
   `pre-push-verification`.

Rollback: `git revert` do PR devolve `e2e/` e o workflow; nenhuma migração de banco, nenhum dado.

## Open Questions

- Nenhuma que bloqueie. Se durante a triagem algum fluxo se mostrar impossível de descer para
  `src/lib` sem simular request scope do Next, a linha dele na tabela diz "abandonado, motivo"
  e o PR decide.

## Registro da triagem

<!-- Preenchido na implementação. Uma linha por spec de e2e/: o que cobria, para onde foi. -->

| Spec | Regra migrada para | Abandonado de propósito |
|---|---|---|
| `service-request.spec.ts` | Pedido duplicado por e-mail e por CPF, recuperação de chave (casa/não casa/bounce permanente) → `src/lib/service-request.test.ts`. Link assinado do PDF nunca vaza a chave, `Content-Disposition` por documento, token cruzado de tenant, token expirado ou forjado → `.../solicitar/requerimento/handle-download.test.ts` e `.../[arquivo]/handle-link.test.ts` (decisão 8). Honeypot (`looksLikeBot`) e atribuição/ato do catálogo já eram `src/core` (`request.test.ts`, `catalog.test.ts`). | Badges do card (on-line/balcão, só identificação), navegação do formulário de gratuidade, máscaras de CPF/telefone, validação client-side antes do POST, tema por host, presença do campo de protocolo por seção habilitada, upload de arquivo (incluindo HEIC sem `type`), abertura de nova aba ao baixar PDF, texto da linha do tempo por status (`Pedido recebido`/`indeferido`/preparo), motivo de indeferimento/cancelamento na tela de consulta (`statusReason` é coluna simples, sem transformação). Tudo aparência ou navegação de browser; a rota de impressão do balcão (`admin/pedidos/.../imprimir`) fica para a task 3.2, que já cobre impressão do painel. |
| `channels.spec.ts` | Manifestação anônima sem chave e sem abertura posterior, identificada com chave, requerimento LGPD com prazo (`dataRightsDeadline`, já `src/core`), resposta do DPO só com protocolo+chave → `src/lib/service-request.test.ts`. Recibo em PDF do canal LGPD (`/lgpd/recibo`), mesmo padrão de handler fino da decisão 8 → `.../lgpd/recibo/handle-receipt.test.ts`. Agendamento (reservar horário, token de cancelamento, cancelar duas vezes cancela uma) → `src/lib/appointments.test.ts`, com `bookAppointment`/`cancelAppointment`/`findByCancelToken` na forma `...With`. | Texto de garantias antes do primeiro campo, seletor de quatro cartões (ouvidoria), obrigatoriedade client-side da declaração LGPD, nome do encarregado publicado (config, não regra), dias/horários oferecidos (UI sobre `AgendaConfig`, já `src/core/scheduling`), e-mail obrigatório no formulário de agendar. |
| `admin-ombudsman.spec.ts` | Resposta limpa rascunho e fica atrás da chave, fechar sem responder não inventa resposta → `respondToRecordWith`/`saveDraftReplyWith`/`updateRequestStatusWith` em `src/lib/service-request.test.ts`. Reversão de andamento e proibição de "Respondida" como opção de menu já são `isAllowedOmbudsmanTransition`, `src/core/request/kinds.test.ts`. | Sessão obrigatória para alcançar a fila (isso é o próprio Better Auth, não-objetivo desta change; a checagem de papel/tenant já está em `tenant-scope.test.ts`), rótulos e visibilidade de botão por tipo de contato (telefone vs. e-mail: mesma função, UI decide o rótulo), textos de confirmação na tela. |
| `admin-lgpd.spec.ts` | Resposta alcançável pela consulta do titular, rascunho que não responde nem notifica → mesmas funções acima. Prazo por requerimento já é `dataRightsDeadline`, `src/core`. | Sessão obrigatória (idem acima); texto da fila (`Dia N de 15`) é `dataRightsDayOfDeadline`, já `src/core`, renderizado sem transformação. |
| `admin-compliance.spec.ts` | — | As duas asserções são: (1) uma resposta de checkbox persiste e reaparece ao voltar — CRUD simples (`saveAnswer`, um `upsert` mais uma linha de auditoria) sem regra distinguível do padrão já provado dezenas de vezes nesta suíte; (2) a fronteira de classe por receita bruta é puramente `src/core/compliance/compliance.test.ts` ("a fronteira só aparece quando uma correção atravessaria a classe"), a tela só exibe o resultado. Nenhuma regra nova para descer; abandonado por ser navegação/exibição sobre o que já é núcleo testado. |
| `citizen-tracking-flag.spec.ts` | A decisão em si (`trackingHref`, que endereço os links de consulta apontam, dado o cookie de override do Vercel Flags) → `src/flags.test.ts`, chamando a função com um `Request` de verdade carregando o cookie cifrado (`flags`' própria forma `flag(req)`), sem servidor nem navegador. Um segredo de cifragem de outro ambiente cai no padrão sem lançar. | Que `/protocolo` e `/acompanhar` continuam abrindo por URL direta (roteamento do Next, não regra do projeto); que o valor da flag não vaza no HTML (é o SDK que decide o que expõe, não código deste repositório). |
| `tenants.spec.ts` | — | Parametrizado sobre `TENANTS`: título da página, `enabledSections`/`noticeSectors` por atribuição (já `src/core/tenant/tenant.test.ts`), dois hosts respondendo como duas serventias (é o registro `TENANTS` sendo lido duas vezes, mesmo resolvedor já testado), painel fechado sem sessão (Better Auth, não-objetivo). Tudo wiring de Server Component sobre decisão pura já coberta. |
| `public-nav.spec.ts` | — | Marcação do link ativo no menu (cliente), submenu que abre/fecha, cabeçalho responsivo em tablet. Navegação e CSS puros, sem decisão de servidor. |
| `platform-page.spec.ts` | — | Conteúdo estático (título, quatro seções, texto legal do canal oficial) e um link no rodapé/wizard. Texto de página, não regra. |
| `privacy-cookies.spec.ts` | — | Aviso de cookies é estado de `localStorage` do navegador; nome e e-mail do encarregado são texto de configuração (`office-dpo`) reproduzido sem transformação, mesmo risco baixo do `saveAnswer` de compliance. |
| `digital-seal.spec.ts` | — | Todos os cinco testes são UI (link para a consulta oficial, formato do placeholder, refuso client-side sem POST, mensagem de captcha expirado, novo código busca nova imagem). O próprio arquivo já diz que a análise de verdade do selo está em `src/lib/seal-lookup.test.ts`, contra fixtures congeladas. Nada de servidor a descer. |
| `support-chat.spec.ts` | Entrar na fila (posição por ordem de chegada), desistir fecha com o motivo certo, avaliação só grava numa conversa já encerrada → `src/lib/chat.test.ts`, com `startConversation`/`closeConversation`/`submitRating`/`queuePosition` na forma `...With`. `isChatEnabled` (botão nunca aparece com o chat desligado) e a janela de horário já são `src/core/chat/hours.test.ts`. | O cookie `chat_token` como `httpOnly` é responsabilidade da action/rota (transporte); o texto "Você é o Nº da fila" é UI sobre o número que `queuePositionWith` já devolve, testado. |
| `admin-login.spec.ts` | Já coberto antes desta change, sem migração: recusa cruzada de tenant e o cookie que não sobrevive (`src/db/tenant-scope.test.ts`, "a user of one office is refused by every other one", "the cookie from a refused login does not survive"); sessão revogada derruba o acesso (`src/db/session-revocation.test.ts`); superadmin acessa qualquer serventia registrada e nenhuma fora do registro (`src/core/auth/roles.test.ts`). | Estados de aviso são renderização pura de `searchParams` (erro/limite/expirada/saiu); tema do painel por tenant já é config testada em `tenant.test.ts`. O detalhe de que a auditoria do login registra o tenant visitado, não o tenant de origem do superadmin (`src/app/admin/actions.ts`, `recordAudit({ tenantSlug: tenant.slug, ... })`), é uma expressão de duas linhas dentro de uma action que já chama `auth.api.signInEmail` (Better Auth, não-objetivo); baixo risco, verificável por leitura, sem teste dedicado. |
| `admin-service-requests.spec.ts` | Mudança de andamento, cancelar/indeferir exigindo motivo (`updateRequestStatusWith`, `requiresStatusReason` já `src/core`), prazo salvo sozinho (`updateRequestDeadlineWith`), valor informado e removido (`setRequestAmountWith`), exigência suspende e a fulfillment retoma o prazo com a contagem certa por Lei 6.015 art. 19 (`registerRequirementWith`/`resolveRequirementWith`/`reconcileDeadlinePauseWith`) → `src/lib/service-request.test.ts`. Impressão do requerimento/comprovante/declaração escreve (ou recusa escrever) no `audit_log`, com a rota dividida em `handle-print.ts` + `route.ts` fino (decisão 8) → `.../imprimir/handle-print.test.ts`. A via assinada aberta pelo painel deixa o mesmo rastro que gerar uma nova via, dividida do mesmo jeito → `.../documento/handle-document.test.ts`. "A rogo exige duas testemunhas" já é `src/core/request/request.test.ts` (`readExemptionForm`). | Fila (contador de aba, busca, filtro, rodapé concordando), telefone aparecendo em "Dados do solicitante", pedido lançado no balcão gerando protocolo e chave (mesma `createServiceRequestWith` já testada, só a tela muda), tela nunca mostrando a chave em claro. A conversa de exigência (`writeStaffMessage`/`writeCitizenMessage`, CRUD de mensagem gated por "exigência ainda pendente") e `deleteRequirement` (exclusão de exigência pendente, com cascade de anexos) não ganharam teste dedicado nesta rodada: mesmo padrão `...With` já provado noutras funções, risco concentrado em "esqueceu de checar `pending`", cobertura recomendada numa passada futura sobre `admin-requirement-conversation.spec.ts`. |
| `admin-requirement-conversation.spec.ts` | — (ver nota acima: `registerRequirement`/`resolveRequirement` já migrados via o spec irmão) | Sessão obrigatória (não-objetivo); atualização das duas telas sem reload é polling client-side; agrupamento de andamentos por fase é UI sobre `statusLabel` (`src/core`, já testado); a conversa em si (escrever e ler mensagens, "quem falou por último") fica para a passada futura citada acima. |
| `admin-users.spec.ts` | Já coberto antes desta change, sem migração: o único admin ativo não pode se autodemover (`src/db/deactivate-account.test.ts`, "the only active admin of an office is the last one"); conta nunca acessada pode ser excluída (`src/db/delete-account.test.ts`); troca de e-mail espera confirmação (`src/db/change-email.test.ts`); convite nomeia papel e nunca senha (`src/core/auth/invite.test.ts`). | "Usuários" no menu por papel é gating já testado; nome do papel em português e reenvio de convite são texto de tela; link de primeiro acesso sem navegação é layout. |
| `admin-settings.spec.ts` | Já coberto antes desta change: validação de chave Pix por tipo (`src/core/tenant/pix.test.ts`, CPF/CNPJ/e-mail/telefone/aleatória); atribuição não delegada não vira controle é gating (`tenant.test.ts`). | O que a serventia salva reaparecer no site público é `tenant_content` upsert + `readTenantOverrides`, mesmo CRUD de baixo risco já aceito para `saveAnswer` (compliance); e-mail inválido recusado é validação de formulário sobre os mesmos helpers de `core/request/form.ts`; as quatro abas navegando é roteamento; sessão obrigatória é não-objetivo. |
| `admin-visual-identity.spec.ts` | — | Publicar/descartar tema é o mesmo CRUD de `tenant_content` acima; seção opcional some da navegação e seção obrigatória sem controle são `isSectionEnabled`/`SECTION_ROUTES`, já `tenant.test.ts`; abas e sessão, como acima. |
| `admin-agenda.spec.ts` | Marcar comparecido/falta só afeta um agendamento ainda `booked` (o mesmo guard de `cancelAppointment`), fechar o dia cancela todos os vivos com um motivo só → `src/lib/appointments.test.ts`, com `markAttendedWith`/`markNoShowWith`/`cancelDayWith`/`appointmentsOnWith`. | Sessão obrigatória; tela de configuração continuar alcançável é navegação; "sem e-mail no no-show" é ausência de chamada, não comportamento a montar; motivo obrigatório para cancelar um agendamento é validação de formulário na action, não verificada nesta rodada. |
| `admin-publications.spec.ts` | Já coberto antes desta change, quase por inteiro: rascunho sem data de entrada, proclamas com saída padrão de 15 dias, arquivamento manual vence qualquer data, validações de publicação (sem data de saída, saída antes da entrada, título/corpo vazios, setor de edital) → `src/core/publications/state.test.ts`, `expiry.test.ts`, `publication.test.ts`. A escrita em si (`office_publications`) é o mesmo CRUD de baixo risco já aceito. | Abas do painel, pré-visualização ao lado da lista, diálogo de confirmação de arquivamento: navegação e UI sobre regra já provada. |
| `admin-transparency.spec.ts` | Já coberto antes desta change: transição de documento (rascunho/publicado/despublicado, nunca de published direto) e categoria fixa (`src/core/transparency/documents.test.ts`); o saldo do boletim, ao centavo, é o exemplo da própria tela (`src/core/transparency/bulletin.test.ts`, "the balance is the screen's example, to the centavo"). | Upload/remoção de documento é o mesmo CRUD de baixo risco; que consolidar substitui o boletim preliminar do mês (índice único por tenant+mês) não ganhou teste dedicado nesta rodada — mesmo padrão de upsert já provado noutras tabelas, risco concentrado no `onConflictDoUpdate`, recomendado numa passada futura sobre `src/lib/transparency.ts`. |
| `admin-overview.spec.ts` | Já coberto antes desta change, por inteiro: toda a priorização da mesa de trabalho (LGPD perto do prazo primeiro, pagamento informado com ação de conferência, item aguardando o cidadão sai da mesa, ordenação por chegada, corte nos seis mais urgentes) e o destaque da agenda de hoje já são `src/core/overview/desk.test.ts` e `urgency.test.ts`, extensivamente. A tela só renderiza o que essas funções decidem. | Atalho para a fila do canal e contagem do atalho da agenda são navegação e leitura direta de contagem já coberta noutro lugar (`bookedCountFrom`). |
| `admin-global-search.spec.ts` | Já coberto antes desta change: classificar o termo como protocolo, CPF mascarado ou nome é `src/core/request/search.test.ts`. | Abrir com Ctrl+K, estado vazio: UI. |
| `admin-sidebar.spec.ts` | — | Único teste: item do menu destacado acompanha a navegação do cliente. Puramente UI. |
| `admin-support-chat.spec.ts` | Limite de três conversas simultâneas já é `src/core/chat/capacity.test.ts` ("the limit is three"); conversa que nomeia um protocolo real é casada com ele, uma que nomeia um inexistente não → `src/lib/chat.test.ts`, com `startConversationWith`. | Sessão obrigatória; o interruptor refletindo em toda parte é polling client-side; contador do sino da sidebar é leitura de `waitingConversationsWith`, já testada; transferir para a fila geral exigindo nota (`transferConversation`) não ganhou teste dedicado nesta rodada — mesma recomendação de passada futura das demais funções de `chat.ts` ainda não convertidas. |
