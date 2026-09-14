## Why

A flag `citizen-tracking-v2` (`src/flags.ts`) existe para ligar/desligar `/acompanhar` sem
deploy, mas o rollout gradual planejado nas changes `feature-flag-acompanhar` e
`migrar-para-vercel-flags` nunca avançou: as tarefas de ligar em Preview/Production seguem
pendentes, e localmente (sem `FLAGS`/`FLAGS_SECRET`) a flag sempre resolve para `/protocolo`. A
experiência de `/acompanhar` (trilho de progresso, conversa de exigência em chat, Pix) já está
pronta e validada; manter uma flag para uma decisão binária que já foi tomada só adiciona uma
dependência de infraestrutura (Vercel Flags), uma leitura assíncrona em três pontos de entrada e
um teste dedicado, sem benefício.

## What Changes

- Remover a flag `citizen-tracking-v2` e o helper `trackingHref()` de `src/flags.ts`
  (arquivo inteiro é removido).
- **BREAKING**: os pontos de entrada de consulta que o próprio site controla — link "Consultar
  protocolo" no cabeçalho, rodapé, menu do celular e o campo de busca da home — passam a apontar
  sempre e definitivamente para `/acompanhar`, sem nenhuma forma de desligar essa escolha em
  runtime.
- `/protocolo` deixa de ser a rota-alvo do site, mas continua existindo e respondendo por acesso
  direto (URL, favoritos, links externos já publicados): não é removida nesta mudança.
- Remover o endpoint de descoberta do Vercel Toolbar (`src/app/.well-known/vercel/flags/route.ts`)
  e as dependências `flags` e `@flags-sdk/vercel` do `package.json`.
- Remover as variáveis `FLAGS` e `FLAGS_SECRET` do `.env.example` e a seção "Flag do
  acompanhamento" do README.
- Remover `src/flags.test.ts` (cobre exclusivamente o comportamento da flag).
- Marcar como obsoletas as changes OpenSpec `feature-flag-acompanhar` e
  `migrar-para-vercel-flags`: suas tarefas de rollout (ligar a flag gradualmente) nunca serão
  concluídas como planejado, porque a flag deixa de existir.

## Capabilities

### New Capabilities
- `citizen-tracking-entry`: define que os pontos de entrada de consulta do próprio site
  (cabeçalho, rodapé, menu, campo de busca da home, link pós-solicitação) sempre resolvem para
  `/acompanhar`, sem flag nem outra forma de alternância em runtime, e que `/protocolo` continua
  acessível por URL direta como rota legada.

### Modified Capabilities
- `public-home`: o requisito "Stub de consulta de protocolo", que descreve `/protocolo` como o
  destino do campo de busca da hero enquanto a consulta "não existe", é substituído — a consulta
  já existe em `/acompanhar` e é para lá que a home aponta.

## Não-objetivos

- Não remove a rota `/protocolo` nem sua tela de detalhe autenticada: ela continua respondendo
  normalmente a quem acessa a URL diretamente. Aposentá-la de vez é decisão futura, fora do
  escopo desta mudança.
- Não altera o layout, conteúdo ou estrutura da home (`/`) — hero, cards de ação, publicações,
  institucional continuam iguais; muda apenas para onde o campo de busca e os links de consulta
  apontam.
- Não introduz nenhum novo mecanismo de alternância (flag, variável de ambiente, config por
  tenant) para essa escolha — ela passa a ser fixa no código.
- Não altera nenhuma regra de negócio de prazo, exigência, pagamento ou conversa dentro de
  `/acompanhar` — apenas quem chega até ela pelos links do próprio site.
- Não arquiva nem sincroniza especificações das changes `feature-flag-acompanhar` e
  `migrar-para-vercel-flags` nos specs principais: elas são abandonadas, não completadas.

## Impact

- **Código:** `src/flags.ts` e `src/flags.test.ts` removidos; `src/app/.well-known/vercel/flags/route.ts`
  removido; `src/app/(public)/layout.tsx`, `src/app/(public)/page.tsx` e
  `src/app/(public)/solicitar/page.tsx` param de ler `trackingHref()` para usar `/acompanhar`
  fixo (via `SECTION_ROUTES["consulta-protocolo"]`, atualizado em
  `src/core/tenant/gating.ts`); `NAV_GROUPS` em `layout.tsx` referencia `/acompanhar` em vez de
  `/protocolo`.
- **Dependências:** `flags` e `@flags-sdk/vercel` removidas do `package.json`.
- **Configuração:** `.env.example` perde `FLAGS`/`FLAGS_SECRET`; README perde a seção "Flag do
  acompanhamento"; a flag `citizen-tracking-v2` pode ser removida do dashboard Flags da Vercel
  (ação manual, fora do código).
- **Specs:** delta em `public-home` (requisito de stub); nova capability `citizen-tracking-entry`.
- **OpenSpec:** changes `feature-flag-acompanhar` e `migrar-para-vercel-flags` marcadas/removidas
  como obsoletas.
- **Testes:** `src/flags.test.ts` removido; nenhum teste novo de infraestrutura de flag é
  necessário, mas a resolução fixa de `SECTION_ROUTES`/`sectionNavLinks` para `/acompanhar` deve
  seguir coberta pelos testes de navegação/gating existentes.
