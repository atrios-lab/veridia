## Why

Toda serventia publica proclamas, avisos e editais — hoje isso não existe em lugar nenhum do
sistema: `/editais` é um placeholder (`ComingSoon`) e a home pública não tem seção nenhuma para
esse tipo de conteúdo. Sem isso, a serventia continua publicando por fora (mural físico, site
antigo) o que devia sair do painel com vigência automática — uma proclama tem prazo legal de
edital (15 dias) e ninguém deveria precisar lembrar de tirá-la do ar na data certa.

## What Changes

- Nova rota `/admin/publicacoes`: lista em abas (No site, Agendadas, Arquivadas), formulário de
  nova publicação (tipo, título, texto, data de entrada, data de saída), edição e arquivamento
  manual, com pré-visualização de como a publicação aparece no site público.
- Proclamas SHALL vir com a data de saída pré-preenchida em 15 dias a partir da data de entrada
  (prazo do edital), ajustável pelo operador.
- Vigência automática: uma publicação entra no site na data de publicação e sai sozinha na data de
  saída, sem ação manual — a saída é calculada na leitura (sem tarefa agendada), mesmo raciocínio
  já usado para o fechamento por inatividade em `add-support-chat`.
- Nova seção "Proclamas e avisos" na home pública, com as publicações vigentes; a seção
  desaparece inteira quando não há nenhuma vigente, mesmo padrão de bloco condicional já usado no
  restante da home (ver `citizenLinks` em `src/app/(public)/page.tsx`).
- Item "Publicações" passa a existir na sidebar do painel (grupo "Serventia"), atrás da permissão
  já existente `content.edit`; publicar (sair do rascunho) exige a permissão já existente, hoje
  não concedida a `staff`, `content.publish`.

## Non-Goals

- **Não** substitui nem estende `/editais` (a seção pública já gateada por atribuição, com
  "setores" de aviso — proclamas/RCPN, registro de imóveis/RI, protesto/PROTESTO, RTD, RCPJ). É um
  conceito diferente, ainda `ComingSoon`, fora de escopo desta mudança — ver design.md.
- **Não** adiciona um novo `Section` ao vocabulário de gating (`src/core/tenant/schema.ts`). A
  seção "Proclamas e avisos" da home não tem rota própria nem precisa de atribuição para existir —
  é um bloco condicional da home, como "Cidadão e transparência" já é, não uma página.
- **Não** notifica ninguém quando uma publicação entra ou sai do site (sem e-mail, sem RSS). Só o
  próprio site reflete a mudança.
- **Não** dá suporte a anexo (PDF, imagem) na publicação — o design mostra só título e texto.
- **Não** cria histórico de revisão nem versionamento do texto — editar sobrescreve.

## Capabilities

### New Capabilities

- `office-publications`: publicação (proclamas, aviso, edital) com vigência por data, rascunho,
  agendamento, arquivamento manual e automático, e pré-visualização — a tela completa do painel.

### Modified Capabilities

- `public-home`: nova seção condicional "Proclamas e avisos", visível só quando há publicação
  vigente.
- `admin-shell`: item "Publicações" passa a existir na sidebar.

## Impact

- `src/db/schema.ts`: tabela nova `officePublications` (ver design.md); migração Drizzle aditiva.
- `src/core/publications/` (novo): domínio puro — tipos, vigência (`publicado`/`agendado`/
  `arquivado` calculados por data), regra dos 15 dias para proclamas, validação Zod.
- `src/lib/publications.ts` (novo): leitura/escrita administrativa e a consulta pública das
  publicações vigentes.
- `src/app/admin/(dashboard)/publicacoes/`: rota nova (lista em abas + formulário) + `actions.ts`.
- `src/app/admin/_components/nav.ts`: item "Publicações".
- `src/app/(public)/page.tsx`: bloco novo "Proclamas e avisos", condicional.
- Testes: `src/core/publications/*.test.ts`, `src/db/publications.test.ts` (PGlite),
  `e2e/admin-publications.spec.ts` novo.
