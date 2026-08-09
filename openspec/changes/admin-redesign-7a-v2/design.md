## Context

A Visão geral atual (`src/app/admin/(dashboard)/page.tsx`) foi implementada no change
`add-admin-channel-queues` seguindo o design 7a v1: saudação, quatro cartões de contadores,
atividade recente e prazos a acompanhar. O design 7a v2 ("mesa de trabalho", seção `7a-v2` de
`Redesign 07 - Admin Visão Geral, Agenda, Ouvidoria e LGPD.dc.html`) substitui essa composição
por uma tela orientada a ação.

Estado relevante do código:

- Os quatro canais moram na tabela única `service_requests` discriminada por `kind`, com
  detalhes por kind em jsonb (`src/core/request/kinds.ts`). Protocolos REQ/AGD/SOL/OUV têm
  helpers prontos (`src/core/request/protocol.ts`: `formatProtocolNumber`,
  `parseProtocolNumber`; `KIND_BY_PREFIX` liga prefixo a kind).
- Consultas existentes: `openCountByKind`/`openRequestCount` (contadores),
  `listRecentActivity`/`listUpcomingDataRightsDeadlines`/`listStalledFulfilledRequirements`
  (`src/lib/admin-overview.ts`), `waitingConversations`/`waitingCount`/`isChatEnabled`
  (`src/lib/chat.ts`). A urgência de LGPD já é lógica pura (`dataRightsUrgency` em
  `lgpd/_components/deadline-badge.tsx:25`).
- Não existe: busca por CPF, command palette (`cmdk` não instalado), nenhum atalho de teclado,
  consulta "agendamentos de hoje", noção de "último item tocado".
- Restrições duras: CSP com nonce (sem script inline), `pnpm check:tokens` (nenhum hex fora de
  `@theme`), `pnpm check:dashes`, código em inglês / UI em português, checagem de permissão
  sempre no servidor.

## Goals / Non-Goals

**Goals:**

- Reproduzir a composição do 7a v2 em `/admin` com dados reais e gating por permissão.
- Busca global por protocolo, CPF ou nome, acessível de qualquer tela do painel (Ctrl K).
- Atalhos de teclado do painel (Ctrl K, G P, G A, N) sem violar a CSP.
- Toda lógica de decisão (urgência, classificação do termo de busca, próximo compromisso) em
  `src/core`, pura e testada com `node --test`.

**Non-Goals:**

- Modelos de exigência, bloqueio de agenda, atribuição de responsável, websocket, índices de
  busca, mudanças nas filas 7b/7c/7d ou no site público (ver proposal, "Não-objetivos").

## Decisions

### 1. Mesa unificada calculada em leitura, ordenação em `src/core`

Uma consulta nova `listDeskItems(tenantSlug)` em `src/lib/admin-overview.ts` traz os itens em
aberto dos quatro kinds (statuses "vivos", mesmas listas que os contadores usam) com os campos
mínimos: kind, protocolo, interessado, status, `createdAt`, detalhes do kind (data/hora da
agenda, direito LGPD, tipo de manifestação) e, para REQ, se a exigência mais recente está
cumprida sem pendente (reaproveitando a subconsulta de `listStalledFulfilledRequirements`).

A ordenação e os rótulos ficam em módulo puro novo `src/core/overview/desk.ts`:
`rankDeskItems(items, today)` devolve os itens ordenados com `{ urgency, chipLabel, actionLabel,
actionHref }`. Camadas de urgência, da mais alta para a mais baixa:

1. SOL com prazo legal vencido ou a 3 dias (reaproveita a regra de `dataRightsUrgency`, movida
   para `src/core/overview/` para ser compartilhada com o badge da fila LGPD);
2. REQ com exigência cumprida aguardando retomada;
3. AGD pedido para hoje ainda não confirmado;
4. demais itens, mais antigo primeiro, com chip "novo"/"há Xh".

A tela mostra os N mais urgentes (N = 6) — o restante continua acessível pelas filas via
"Situação dos canais". Alternativa considerada: uma consulta SQL única com `ORDER BY CASE` —
rejeitada porque a regra de urgência ficaria no SQL, fora do núcleo puro e sem teste unitário.

### 2. Próximo passo é link, não ação inline

Os botões da mesa ("Responder agora", "Retomar análise", "Confirmar", "Ler manifestação",
"Iniciar análise") navegam para o detalhe correspondente (`/admin/{fila}/[protocolo]`), onde as
server actions e as checagens já existem. Nada de mutação a partir da Visão geral. Isso segue o
design (os cards do mock são âncoras) e evita duplicar validação/autorização. Alternativa
(confirmar horário direto da mesa) rejeitada: exigiria reexpor `confirmAppointment` fora do
detalhe e um segundo caminho de erro/toast.

### 3. "Agenda de hoje" é consulta por dia no fuso da serventia

Nova consulta `listTodayAppointments(tenantSlug, todayIso)` filtrando kind `appointment`,
`details->>'date' = todayIso` (dia calculado com `OFFICE_TIME_ZONE`, como o resto do painel) e
statuses vivos + atendidos (o mock mostra "concluído"). Ordena por `slotHour`. O destaque
"próximo" é lógica pura em `src/core/overview/desk.ts` (`nextAppointment(slots, now)`): primeiro
horário confirmado ainda não passado; pedidos não confirmados aparecem como "aguardando sua
confirmação".

### 4. "Acontecendo agora" reusa a fila do chat e o polling existente

O card mostra a conversa aguardando há mais tempo (`waitingConversations()[0]`) com o tempo de
espera, e "Assumir conversa" leva a `/admin/atendimento` (a atribuição acontece lá, como hoje).
O componente `QueuePoller` (`atendimento/_components/queue-poller.tsx`) é promovido para
`src/app/admin/_components/` e montado também na Visão geral, com o mesmo intervalo de 5s
condicionado à visibilidade da aba. O card não renderiza quando o chat está desabilitado ou não
há ninguém esperando. Sem permissão `chat.manage`, o card é omitido.

### 5. "Continuar de onde parou" vem do `audit_log` do próprio usuário

Nova consulta `findResumePoint(tenantSlug, userId)`: última entrada de `audit_log` com
`actor_id = userId` cujo alvo (mesmo join id-ou-protocolo de `listRecentActivity`) ainda está em
status vivo. Mostra protocolo, rótulo do kind e a frase de `activitySentence`; o botão
"Continuar" leva ao detalhe. Sem entrada aplicável, o card não renderiza. Nenhuma tabela nova —
alternativa "gravar último item visitado por usuário" rejeitada por criar escrita em toda
navegação para um ganho marginal.

### 6. Busca global: server action + overlay próprio, sem cmdk

- **Classificação do termo** em módulo puro novo `src/core/request/search.ts`:
  `classifySearchTerm(raw)` devolve `{ type: "protocol" | "cpf" | "name", value }` —
  protocolo se `parseProtocolNumber` reconhece, CPF se sobram 11 dígitos ao remover máscara,
  nome caso contrário. Testes cobrem os três tipos e ambiguidades (ex.: "maria 123").
- **Consulta** `searchRecords(tenantSlug, term, kinds)` em `src/lib/service-request.ts`:
  protocolo → igualdade em `protocol_number` (normalizado); CPF → igualdade após remover
  não-dígitos dos dois lados (`regexp_replace(cpf, '\D', '', 'g')`); nome → `ilike` em
  `applicant_name` (e em `protocol_number` como fallback para prefixos parciais). Limite de 8,
  mais recente primeiro, restrita aos kinds que a sessão pode operar.
- **Transporte**: server action em `src/app/admin/(dashboard)/search/actions.ts` (valida sessão
  e permissões; o gating de kinds acontece no servidor, nunca no cliente).
- **UI**: client component `GlobalSearch` montado no layout `(dashboard)` — overlay simples
  (input + lista, navegação por setas/Enter/Esc, `role="dialog"` + `aria-modal`), com debounce
  de ~250ms e mínimo de 2 caracteres. Enter navega para
  `/admin/{fila}/[protocolo]` resolvendo a fila por `KIND_BY_PREFIX`. O campo de busca no
  cabeçalho da Visão geral é um botão que abre o mesmo overlay. `cmdk`/Radix não entram:
  dependência nova para um overlay de uma lista não se justifica no stack atual (sem nenhuma
  primitiva Radix no projeto).

### 7. Atalhos de teclado num único listener no layout

Client component `ShortcutListener` montado no layout `(dashboard)` (bundle normal, compatível
com a CSP — nada inline): `Ctrl/Cmd+K` (com `preventDefault`) abre a busca; `G` seguido de
`P`/`A` em até 1s navega para `/admin/pedidos`/`/admin/agenda` via `router.push`; `N` navega
para `/admin/pedidos/novo`. Sequências são ignoradas quando o foco está em
input/textarea/select/`contenteditable` ou com o overlay aberto (exceto Esc/Ctrl K). Atalhos de
navegação só disparam para rotas que a sessão pode acessar — a lista de atalhos ativos vem do
servidor (mesma fonte do gating da sidebar); a rota destino continua checando no servidor.

### 8. Cabeçalho da Visão geral é variante própria; tokens existentes, sem hex novo

`AdminPageHeader` segue intocado para as demais telas. A Visão geral ganha
`_components/overview-header.tsx` (saudação existente + resumo "N itens na sua mesa · M prazos
críticos" + botão-gatilho da busca com a pílula "Ctrl K" + data). As cores do mock
(`#123c2a`, `#8f7238`, bege) mapeiam para os tokens `--color-admin-*` já existentes
(`admin-primary`, `admin-accent`, `admin-surface` etc.) — fidelidade ao sistema de tokens vence
fidelidade de pixel, porque o painel herda o tema do tenant e um hex fixo quebraria os demais
temas (e o `check:tokens`).

### 9. E2e substitui o da 7a v1; lógica pura ganha teste unitário

`e2e/admin-overview.spec.ts` é reescrito no mesmo padrão (seed por SQL cru, tenant
`cartorio-marinho`, ano fictício 2097): mesa ordenada por urgência, links de próximo passo,
situação dos canais, agenda de hoje. Novo `e2e/admin-global-search.spec.ts` cobre Ctrl K →
busca por protocolo e por CPF → navegação ao detalhe. `src/core/overview/desk.test.ts` e
`src/core/request/search.test.ts` cobrem a ordenação e a classificação.

## Risks / Trade-offs

- [Ctrl+K conflita com atalho nativo de alguns navegadores] → `preventDefault` no `keydown`
  resolve com a aba focada; os cartões de atalho continuam clicáveis como caminho alternativo.
- [Fan-out de consultas na Visão geral (mesa, agenda, contadores, chat, retomada)] →
  `Promise.all` no server component; todas as consultas filtram por índices de tenant
  existentes; a mesa é limitada a 6 itens no SQL da camada de dados quando possível.
- [Busca por CPF com `regexp_replace` linha a linha não usa índice] → aceito (non-goal); volume
  por tenant é pequeno e o limite é 8 resultados.
- [`audit_log.target_id` guarda id ou protocolo] → reusar exatamente o join já validado de
  `listRecentActivity` em vez de reimplementar.
- [Sequência "G então P" pode surpreender quem digita fora de campos] → janela curta de 1s e
  supressão em qualquer elemento editável; o cartão "Atalhos de teclado" documenta o
  comportamento.
- ["Sua mesa hoje" com muitos itens urgentes esconde o resto] → "Situação dos canais" mantém a
  visão de totais com link para cada fila, e o resumo do cabeçalho conta o total da mesa.

## Migration Plan

Sem mudança de schema e sem migração. Deploy único; rollback é reverter o deploy. O spec
`admin-overview` foi sincronizado para `openspec/specs/` antes deste change (pré-requisito já
cumprido).

## Open Questions

- Nenhuma bloqueante. O limite de 6 itens na mesa e a janela de 1s da sequência de teclas são
  palpites razoáveis a validar em uso.
