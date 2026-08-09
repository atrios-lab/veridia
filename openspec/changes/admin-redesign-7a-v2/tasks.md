## 1. Núcleo puro (src/core)

- [x] 1.1 Criar `src/core/overview/urgency.ts` movendo a regra `dataRightsUrgency` de
  `lgpd/_components/deadline-badge.tsx` para o núcleo; o badge da fila LGPD passa a importar do
  núcleo. Teste `node --test` cobrindo vencido, a 3 dias e folgado.
- [x] 1.2 Criar `src/core/overview/desk.ts` com `rankDeskItems(items, today)`: camadas de
  urgência (SOL perto do prazo/vencido, REQ exigência cumprida, AGD para hoje não confirmado,
  demais por idade), chip em português ("vence em 3d", "venceu", "para hoje", "há 2h", "novo"),
  rótulo e href do próximo passo por kind/estado, e corte nos 6 mais urgentes. Teste cobrindo a
  ordem entre camadas, o desempate por idade e os rótulos.
- [x] 1.3 Adicionar `nextAppointment(slots, now)` em `src/core/overview/desk.ts` (próximo
  confirmado ainda não ocorrido; atendidos como concluídos; não confirmados como aguardando).
  Teste com dia misto (atendido, confirmado futuro, pedido enviado).
- [x] 1.4 Criar `src/core/request/search.ts` com `classifySearchTerm(raw)` devolvendo
  protocolo (via `parseProtocolNumber`), CPF (11 dígitos sem máscara) ou nome. Teste cobrindo os
  três tipos, máscaras de CPF e termos ambíguos.

## 2. Camada de dados (src/lib)

- [x] 2.1 Adicionar `listDeskItems(tenantSlug)` em `src/lib/admin-overview.ts`: itens em aberto
  dos quatro kinds com campos mínimos para a mesa (kind, protocolo, interessado, status,
  createdAt, detalhes do kind) e o sinal de exigência cumprida sem pendente para REQ
  (reaproveitando a subconsulta de `listStalledFulfilledRequirements`).
- [x] 2.2 Adicionar `listTodayAppointments(tenantSlug, todayIso)` em `src/lib/admin-overview.ts`:
  kind `appointment`, `details->>'date'` igual ao dia corrente no fuso da serventia, statuses
  vivos + atendido, ordenado por `slotHour`.
- [x] 2.3 Adicionar `findResumePoint(tenantSlug, userId)` em `src/lib/admin-overview.ts`: última
  entrada do `audit_log` com `actor_id = userId` (mesmo join id-ou-protocolo de
  `listRecentActivity`) cujo alvo continua em status vivo.
- [x] 2.4 Adicionar `searchRecords(tenantSlug, term, kinds)` em `src/lib/service-request.ts`:
  igualdade de protocolo normalizado, igualdade de CPF via `regexp_replace` nos dois lados, ou
  `ilike` em nome (com fallback de prefixo de protocolo), limitada a 8, mais recente primeiro,
  restrita aos kinds informados.

## 3. Busca global

- [x] 3.1 Criar a server action de busca em
  `src/app/admin/(dashboard)/search/actions.ts`: valida sessão/tenant, resolve os kinds
  permitidos pelo papel (`can`), classifica o termo com `classifySearchTerm` e chama
  `searchRecords`; devolve resultados com protocolo, canal, interessado, situação e rota de
  destino (via `KIND_BY_PREFIX`).
- [x] 3.2 Criar o client component `src/app/admin/_components/global-search.tsx`: overlay
  `role="dialog"` `aria-modal` com input focado ao abrir, debounce de 250ms, mínimo de 2
  caracteres, navegação por setas/Enter/Esc, estados de carregando/nenhum resultado em
  português.
- [x] 3.3 Montar o overlay no layout `(dashboard)` e expor um contexto/evento para abri-lo a
  partir do gatilho do cabeçalho da Visão geral.

## 4. Atalhos de teclado

- [x] 4.1 Criar `src/app/admin/_components/shortcut-listener.tsx`: Ctrl/Cmd+K (com
  `preventDefault`) abre a busca; sequência G→P e G→A com janela de 1s navega para
  `/admin/pedidos` / `/admin/agenda`; N navega para `/admin/pedidos/novo`; inerte em campos
  editáveis e com o overlay aberto (exceto Esc/Ctrl K); recebe do servidor a lista de atalhos
  ativos conforme as permissões da sessão.
- [x] 4.2 Montar o `ShortcutListener` no layout `(dashboard)` passando as rotas permitidas
  (mesma fonte de gating da sidebar).

## 5. Visão geral (UI)

- [x] 5.1 Adicionar o ícone `search` a `src/app/admin/_components/icon.tsx` (e demais ícones
  novos necessários aos blocos), usando apenas tokens existentes no `@theme`.
- [x] 5.2 Criar `_components/overview-header.tsx`: saudação + resumo "N itens na sua mesa · M
  prazos críticos" + gatilho da busca com pílula "Ctrl K" + data por extenso no fuso da
  serventia.
- [x] 5.3 Criar o bloco de atalhos de ação: "Novo pedido no balcão" (dica da tecla N),
  "Confirmar horário" (contagem de AGD aguardando confirmação) e "Nova publicação"; gating por
  permissão; sem atalhos para funcionalidades inexistentes.
- [x] 5.4 Criar o bloco "Sua mesa hoje" renderizando `rankDeskItems`: chip de urgência,
  protocolo, interessado (ou "manifestação anônima"), resumo e botão-link do próximo passo;
  estado vazio explícito.
- [x] 5.5 Criar o bloco "Agenda de hoje" com destaque do próximo compromisso
  (`nextAppointment`), concluídos e aguardando confirmação, link "abrir agenda" e estado vazio.
- [x] 5.6 Promover `QueuePoller` de `atendimento/_components/` para
  `src/app/admin/_components/` (atualizando o import existente) e criar o card "Acontecendo
  agora": conversa aguardando há mais tempo, tempo de espera, "Assumir conversa"; oculto sem
  fila, sem permissão `chat.manage` ou com o chat desabilitado.
- [x] 5.7 Criar o card "Continuar de onde parou" com `findResumePoint` e frase de
  `activitySentence`; oculto sem item aplicável.
- [x] 5.8 Criar os blocos "Situação dos canais" (lista compacta com contagens, links, destaque
  de prazo crítico e gating por permissão) e "Atalhos de teclado" (documentando Ctrl K, G P,
  G A, N).
- [x] 5.9 Reescrever `src/app/admin/(dashboard)/page.tsx` compondo os blocos com `Promise.all`,
  removendo contadores grandes, atividade recente e o bloco antigo de prazos; remover código
  morto que sobrar em `admin-overview.ts` (mantendo o que o resume point reusa).

## 6. Testes e verificação

- [x] 6.1 Reescrever `e2e/admin-overview.spec.ts` no padrão existente (seed SQL, tenant
  `cartorio-marinho`, ano 2097): mesa ordenada por urgência com próximo passo, atalhos de ação,
  agenda de hoje, situação dos canais e estados vazios.
- [x] 6.2 Criar `e2e/admin-global-search.spec.ts`: Ctrl K abre o overlay em qualquer tela,
  busca por protocolo e por CPF navega ao detalhe, termo sem resultado mostra estado vazio.
- [x] 6.3 Rodar `pnpm test`, `pnpm tsc --noEmit`, `biome check`, `pnpm check:tokens`,
  `pnpm check:dashes` e `pnpm build`; corrigir o que falhar.
- [x] 6.4 Validar visualmente contra a seção `7a-v2` do design (zoom nos blocos, chips e
  hierarquia) e ajustar espaçamentos/tipografia com tokens existentes.
