## Why

A flag `citizen-tracking-v2` (ver `[[feature-flag-acompanhar]]`) hoje mora num Edge Config editado à mão (`{ "flags": { "citizen-tracking-v2": true } }`), com o Flags SDK genérico (`@flags-sdk/global-config`) só lendo esse JSON. A Vercel lançou o **Vercel Flags** nativo da plataforma (GA): flag criada e ligada pelo próprio dashboard do projeto, sem provisionar nem editar Edge Config, com fallback embutido (definições da flag são buscadas uma vez no build e empacotadas no deploy). Migrar agora evita manter um Edge Config só para isso e destrava, sem novo trabalho de infra, o Flags Explorer já usado no Toolbar.

## What Changes

- Trocar o adapter do Flags SDK em `src/flags.ts`: sai `@flags-sdk/global-config` (lê Edge Config), entra `@flags-sdk/vercel` (`vercelAdapter`, lê a SDK Key da própria Vercel Flags).
- A flag `citizen-tracking-v2` passa a ser criada e ligada/desligada pelo dashboard **Flags** do projeto na Vercel, não mais editando o item `flags` de um Edge Config.
- Trocar a variável de ambiente: sai `EDGE_CONFIG`, entra `FLAGS` (SDK Key da Vercel Flags), lida via `vercel env pull` (OIDC) em vez de connection string manual.
- `FLAGS_SECRET` continua existindo (Flags Explorer/Toolbar overrides), sem mudança de uso.
- Remover o recurso de infraestrutura Edge Config `veridia-flags` (Storage) depois que a flag estiver recriada e validada no Vercel Flags — **não antes**, para não perder o rollback.
- Atualizar `README.md` (seção Deploy) e `.env.example` para refletir `FLAGS` no lugar de `EDGE_CONFIG`.
- Ajustar `e2e/citizen-tracking-flag.spec.ts` apenas se o mecanismo de override por cookie mudar de nome/formato entre os pacotes (a confirmar em design.md); o comportamento testado (links, ausência do valor no HTML, acesso direto às duas rotas) não muda.

## Non-goals

- Não adota targeting por entidade, segmentos ou experimentos (A/B) do Vercel Flags nesta mudança — a flag continua um único on/off global, como já é.
- Não muda `trackingHref()` nem quem a chama (cabeçalho, rodapé, menu do celular, home, chat) — só a origem do valor lido.
- Não remove `/protocolo` nem altera o comportamento de acesso direto às duas rotas.
- Não migra nenhuma outra configuração do projeto para Edge Config/Vercel Flags — escopo é só a flag `citizen-tracking-v2`.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `citizen-tracking-rollout`: os requisitos de fallback e de "ambiente local/CI sem configuração adicional" citam Edge Config especificamente; passam a citar Vercel Flags (SDK Key ausente/serviço fora do ar → valor padrão desligado, sem variável nova exigida em dev/CI). Comportamento observável pelo cidadão não muda.

  Nota: essa capability ainda vive como delta spec em `openspec/changes/feature-flag-acompanhar/specs/citizen-tracking-rollout/spec.md` (aquela change segue in-progress, ainda não arquivada/sincronizada em `openspec/specs/`). Esta mudança assume que `feature-flag-acompanhar` chega a esse estado antes ou junto desta.

## Impact

- `package.json` / `pnpm-lock.yaml`: remove `@flags-sdk/global-config`, adiciona `@flags-sdk/vercel`.
- `src/flags.ts`: troca de adapter e da condição que hoje distingue dev/CI (`process.env.EDGE_CONFIG`) pela equivalente em Vercel Flags.
- `.env.example`, `README.md`: `EDGE_CONFIG` sai, `FLAGS` entra; passo de setup local vira `vercel env pull` em vez de copiar connection string.
- `e2e/citizen-tracking-flag.spec.ts`, `playwright.config.ts`: possível ajuste no mecanismo de override cifrado, a confirmar.
- Infra: recurso Edge Config `veridia-flags` fica obsoleto e é removido só depois da validação; flag recriada no dashboard **Flags** do projeto Vercel.
- Nenhuma migração de banco. Nenhuma rota nova.
