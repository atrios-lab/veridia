## Context

O produtor existe e a vitrine não. `add-office-publications` (implementada, não arquivada) deu ao
painel tipos (`marriageBanns`/`notice`/`publicNotice`), vigência por data calculada em leitura
(`src/core/publications/state.ts`) e `livePublications()` — que a home já consome. A página
pública `/editais` é `ComingSoon`, e o e2e de tenants só confere os chips de setor.

O legado (`apps/web/src/app/(site)/editais/`) organiza por setor em duas etapas no cliente
(escolher setor → ver lista), busca `/api/editais` por fetch, mostra só setores com edital
("vazio honesto") e cada setor traz prose legal fixa (Lei 9.492/1997, Lei 6.015/1973...). O
modelo do Veridia não tem setor na publicação — só tipo.

## Goals / Non-Goals

**Goals:**
- `/editais` real: vigentes, por setor, com a explicação legal de cada setor, vazio honesto.
- Setor na publicação com o mínimo de pergunta ao operador (proclamas nunca perguntam).
- Server-rendered, mesma disciplina do resto do site público.

**Non-Goals:**
- Anexo em PDF, detalhe por edital, RSS, setor `notas`, mudanças na home.

## Decisions

### 1. Setor é coluna anulável, derivado para proclamas, perguntado só para edital

`office_publications.sector` (text, anulável). No núcleo, o schema do formulário valida:
`marriageBanns` → força `proclamas`; `publicNotice` → setor obrigatório dentre
`noticeSectors(tenant)`; `notice` → sempre nulo. Linhas antigas (sector null) são "edital geral
da serventia" na página — grupo genérico que também acolhe o que o legado chamava de setor
`notas`, já que o gating do Veridia decidiu por 5 setores.

*Alternativa descartada:* derivar setor só em leitura, sem coluna. Funciona para proclamas
(kind já diz), mas um `publicNotice` de usucapião (RI) e um de notificação (RTD) são
indistinguíveis sem o dado — e a distinção é o valor da página.

### 2. Metadados de setor são config-as-code no núcleo

`NOTICE_SECTOR_META` ao lado de `NOTICE_SECTOR_ATTRIBUTION` em `src/core/tenant/gating.ts` (ou
módulo irmão): sigla, nome do setor, tipo de edital e a explicação legal — o mesmo texto do
legado, revisado. É prose legal idêntica entre serventias, mesma natureza do catálogo de atos:
config-as-code, não conteúdo por tenant.

### 3. Uma página, sem estado no cliente

O legado faz duas etapas com `useState` + fetch. Aqui é um server component único: setores com
vigentes viram âncoras no topo (os mesmos chips `data-notice-sector`, agora só dos setores com
conteúdo) e as listas vêm agrupadas abaixo, na ordem de `NOTICE_SECTOR_ATTRIBUTION`, grupo
genérico por último. Menos código, sem loading nem estado de erro no cliente, e o cidadão chega
por link direto (`/editais#protesto`).

*Alternativa descartada:* replicar as duas etapas com `?setor=`. URLs mais limpas por âncora, e
uma serventia pequena raramente tem mais de um punhado de editais vigentes ao mesmo tempo.

### 4. Leitura reusa `livePublications`

A página filtra `kind !== "notice"` sobre o que `livePublications(tenant.slug)` devolve. Sem
query nova: a home já paga esse SELECT e o volume é pequeno por construção (vigência expira).

### 5. O e2e muda de significado junto com a página

`tenants.spec.ts` hoje espera `noticeSectors(tenant)` completos nos chips. Com vazio honesto,
os chips passam a ser "setores com vigente" — subconjunto possivelmente vazio. O teste passa a
verificar que os chips renderizados ⊆ `noticeSectors(tenant)` e que a página responde 200 com o
shell; a cobertura de "setor certo para publicação certa" desce para o teste do núcleo e o e2e
de publicações (que cria vigente de verdade).

## Risks / Trade-offs

- **Coluna nova exige migração manual antes do deploy** → mesmo protocolo da `0007`: expand,
  `pnpm db:migrate` no banco de produção antes do deploy publicar código que seleciona `sector`.
- **Preview do painel precisa continuar fiel** ("mostra exatamente o que o site exibe") → o
  requisito já existe na capability; a tarefa de UI inclui o setor no preview para não quebrá-lo.
- **Edital sem setor acumulando no grupo genérico** → só acontece com linhas anteriores à
  mudança; novas exigem setor no formulário. Aceito e sinalizado no grupo.

## Migration Plan

Deploy único, com `pnpm db:migrate` antes (coluna anulável). Rollback: reverter o commit; a
coluna fica inerte.

## Open Questions

- O texto legal por setor vem do legado já aprovado pela serventia; vale uma passada do
  ux-writer antes de publicar, mas não bloqueia a implementação.
