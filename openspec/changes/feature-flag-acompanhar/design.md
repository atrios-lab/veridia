## Context

`/acompanhar` já está implementada: trilho de progresso para pedido de serviço, e os cartões de LGPD/ouvidoria reaproveitados de `/protocolo`. Hoje ela não tem nenhum controle de ativação — quem sabe a URL e tem protocolo + chave já cai nela. O site continua anunciando só `/protocolo` (menu, rodapé, home) como a via de consulta.

Este projeto roda em deploy único na Vercel (`.vercel/repo.json` liga o repo ao projeto `veridia`) e já depende de `@vercel/blob`. Não existe hoje nenhum mecanismo de feature flag genérico — o único "liga/desliga" existente é `disabledSections` por tenant (`src/core/tenant/gating.ts`), gravado no banco via o painel admin, pensado para atribuição legal, não para rollout de UI.

## Goals / Non-Goals

**Goals:**
- Decidir, sem novo deploy, se os pontos de entrada de consulta do site apontam para `/acompanhar` ou para `/protocolo`.
- Avaliar a flag **só no servidor** (Server Components / Server Actions), nunca em código de cliente.
- Permitir que alguém do time ligue a flag por sessão própria (via Vercel Toolbar) para testar em produção antes de ligar para todo mundo.
- Rollback instantâneo (segundos, sem deploy) se algo quebrar.

**Non-Goals:**
- Rollout percentual ou por-tenant nesta fase (ver Open Questions).
- Remover ou redirecionar `/protocolo` — ela continua respondendo normalmente nos dois estados da flag.
- Qualquer mudança em `lookupProtocolDetail`, no schema do banco, ou nas regras de prazo/exigência/pagamento.

## Decisions

### 1. Flags SDK da Vercel + Edge Config, não uma env var solta

Adotar o pacote `flags` (Flags SDK) com um flag declarado em `src/flags.ts`, avaliado a partir de um Edge Config do projeto Vercel.

Alternativa considerada — env var lida via `process.env` (`ACOMPANHAR_ENABLED=true`): mais simples, zero dependência nova, mas para mudar precisa editar a env var no dashboard e isso conta como novo deploy/redeploy de ambiente na Vercel; não dá override por sessão; não aparece no Toolbar; não abre caminho natural para segmentação futura. Como o pedido explícito foi "sem novo deploy" e com possibilidade de teste controlado, o Flags SDK + Edge Config resolve isso de fábrica e é o caminho oficialmente suportado pela Vercel para Next.js.

Alternativa considerada — estender `disabledSections` (gating por tenant já existente): rejeitada porque aquele mecanismo é publicado pela própria serventia no painel dela (é conteúdo do tenant), e misturar um interruptor de rollout interno do time ali vazaria uma decisão de migração de produto para dentro das configurações que a serventia vê e edita.

### 2. O que a flag decide: para onde os links do site apontam, não se a rota existe

`/acompanhar` e `/protocolo` continuam as duas acessíveis por URL direta nos dois estados da flag — a flag não bloqueia nenhuma delas. O que ela decide é o `href` usado pelos pontos de entrada que o próprio site controla:

- O link "Consultar protocolo" no cabeçalho (`(public)/layout.tsx`).
- O link equivalente no rodapé.
- Qualquer CTA de acompanhamento na home.

Concretização: um helper único, algo como `trackingHref()` em `src/lib/tenant.ts` (ou um novo `src/lib/tracking-flag.ts`), lido pelos 2–3 pontos de entrada acima. Um único lugar lê a flag; os call sites só usam o `href` resultante.

Isso é deliberadamente mais fraco que um bloqueio de rota: não é controle de acesso (não há dado protegido em `/acompanhar` que não esteja igualmente atrás do par protocolo + chave em `/protocolo`), é uma decisão de qual experiência o site recomenda agora. Por isso não fere o princípio "esconder botão não é controle de acesso" — aqui não há botão escondendo uma checagem de permissão, as duas telas já fazem a mesma checagem (protocolo + chave) independentemente da flag.

### 3. Avaliação e fallback

- Flag declarada com `defaultValue: false`: se o Edge Config estiver inacessível ou mal configurado, o comportamento cai para o de hoje (`/protocolo`), nunca para o novo.
- Em ambiente local (`pnpm dev`) e em CI, sem `EDGE_CONFIG` configurado, o SDK usa o `defaultValue` — ou seja, comportamento de hoje por padrão, sem exigir nenhuma env var nova para rodar localmente.
- Para o e2e exercitar o caminho novo em CI sem depender de um Edge Config real, usar o mecanismo de `overrides` do Flags SDK (o mesmo que o Toolbar usa) setado diretamente no teste Playwright, não uma segunda variável de ambiente de build.

## Risks / Trade-offs

- [Risco] `/protocolo` e `/acompanhar` continuam as duas no ar nos dois estados da flag, então quem já salvou o link de `/protocolo` não migra sozinho → Mitigação: aceitável nesta fase (não-objetivo forçar migração); revisitar consolidação depois que a flag estiver ligada e estável para todo mundo.
- [Risco] Dependência de infraestrutura nova (Edge Config) que o projeto não tinha → Mitigação: leitura, gratuita na escala do projeto, e com fallback seguro (`false`) se mal configurada.
- [Risco] Se um quarto ponto de entrada for adicionado depois (ex: um botão novo em uma página de e-mail) e não usar o helper central, ele fica preso em `/protocolo` mesmo com a flag ligada → Mitigação: `trackingHref()` como único ponto de leitura, documentado no próprio arquivo.

## Migration Plan

1. Adicionar a dependência `flags`; provisionar um Edge Config no projeto Vercel; configurar `EDGE_CONFIG` em preview e produção (local/CI seguem sem ela, usando o default).
2. Declarar a flag em `src/flags.ts`, `defaultValue: false`.
3. Criar `trackingHref()` e trocar os 2–3 pontos de entrada (menu, rodapé, home) para usá-lo.
4. Publicar com a flag desligada — nenhuma mudança visível.
5. Ligar via override do Toolbar só para o time; validar manualmente em pelo menos dois tenants/temas diferentes.
6. Ligar no Edge Config para preview, depois produção.
7. Rollback = voltar o valor no Edge Config para `false` (segundos, sem deploy).
8. Aposentar `/protocolo` (se for o caso) fica como mudança futura separada, fora desta proposta.

## Open Questions

- A flag deveria evoluir para por-tenant (algumas serventias primeiro) em vez de global? Fica para uma mudança futura se o rollout global expuser diferença de comportamento entre tenants/temas.
- O e2e deveria cobrir os dois estados da flag em todo push, ou só o caminho novo nas specs específicas de `/acompanhar` e manter o resto no default (desligado)? Proposto: a segunda opção, para não dobrar o tempo de CI.
