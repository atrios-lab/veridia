## 1. Núcleo do domínio (`src/core/publications`)

- [x] 1.1 `src/core/publications/publication.ts` (novo): tipo `PublicationKind`
      (`marriageBanns`/`notice`/`publicNotice`), schema Zod do formulário (título, texto, tipo,
      datas), sem I/O.
- [x] 1.2 `src/core/publications/state.ts` (novo): `publicationState(pub, today)` →
      `"draft" | "scheduled" | "live" | "archived"`, pura, conforme a tabela de estados do
      design.md.
- [x] 1.3 `src/core/publications/expiry.ts` (novo): `defaultExpiry(kind, publishAt)` — 15 dias
      para `marriageBanns`, `undefined` para os demais.
- [x] 1.4 Testes: `publication.test.ts`, `state.test.ts` (as quatro transições de data),
      `expiry.test.ts`.

## 2. Banco de dados

- [x] 2.1 `src/db/schema.ts`: tabela `officePublications` (`id`, `tenantSlug`, `kind`, `title`,
      `body`, `publishAt` nullable, `expireAt` nullable, `archivedAt` nullable, `createdBy`,
      `createdAt`, `updatedAt`); index em `(tenant_slug, publish_at)`.
- [x] 2.2 Rodar `drizzle-kit generate`, conferir a migração gerada, commitar junto.
- [x] 2.3 `src/db/publications.test.ts` (PGlite): inserir/ler nos quatro estados, ordenação por
      `publishAt` decrescente.

## 3. Permissões

- [x] 3.1 `src/core/auth/roles.ts`: nenhuma permissão nova — reaproveitar `content.edit`
      (existente, admin + staff) e `content.publish` (existente, hoje só admin); conferir que
      `ROLE_PERMISSIONS` já reflete isso (nenhuma mudança esperada aqui, só verificação).
- [x] 3.2 Testes de núcleo cobrindo o par de permissões aplicado à transição de rascunho para
      publicado (ver 4.3). Já coberto por `src/core/auth/roles.test.ts` ("staff may edit but not
      publish..."); nenhum teste novo necessário, a distinção genérica já está provada.

## 4. Camada de dados administrativa

- [x] 4.1 `src/lib/publications.ts` (novo): `listPublications(tenantSlug)` — todas; estado é
      calculado pelo chamador via `publicationState()`, não gravado.
- [x] 4.2 `src/lib/publications.ts`: `createPublication(tenantSlug, data, actorUserId)` — grava
      como rascunho se `publishAt` ausente.
- [x] 4.3 `src/lib/publications.ts`: `updatePublication(tenantSlug, id, data, actorUserId)` —
      escreve sempre; a checagem de `content.publish` (transição rascunho → publicada) vive na
      action, seguindo o mesmo padrão de `src/lib/service-request.ts` (permissão nunca checada na
      camada de dados). Chama `recordAudit()`.
- [x] 4.4 `src/lib/publications.ts`: `archivePublication(tenantSlug, id, actorUserId)` — grava
      `archivedAt` com o instante corrente.
- [x] 4.5 `src/lib/publications.ts`: `livePublications(tenantSlug)` — só as vigentes, ordenadas
      por `publishAt` decrescente, para a home pública.

## 5. Painel — lista e formulário

- [x] 5.1 `src/app/admin/(dashboard)/publicacoes/page.tsx`: abas (No site, Agendadas, Arquivadas,
      Rascunhos) com contagem; checagem de `content.edit` no servidor.
- [x] 5.2 `src/app/admin/(dashboard)/publicacoes/_components/publication-form.tsx`: tipo, título,
      texto, datas, pré-visualização ao vivo; sugestão dos 15 dias para proclamas
      (`defaultExpiry`).
- [x] 5.3 `src/app/admin/(dashboard)/publicacoes/actions.ts`: criar, editar, publicar (checa
      `content.publish` quando aplicável), arquivar — cada uma chamando a função correspondente
      do passo 4.
- [x] 5.4 Rascunho aparece numa aba/filtro "Rascunhos" além das três do design, para o botão
      "Salvar rascunho" ter destino (ver design.md, Decisions).

## 6. Navegação

- [x] 6.1 `src/app/admin/_components/nav.ts`: item "Publicações" (grupo "Serventia", permissão
      `content.edit`).

## 7. Home pública

- [x] 7.1 `src/app/(public)/page.tsx`: nova seção "Proclamas e avisos", buscando
      `livePublications(tenant.slug)` (capada nas 6 mais recentes, ver design.md, Risks),
      condicional (`length > 0`), mesmo padrão de bloco condicional já usado para `citizenLinks`.
- [x] 7.2 Cores só de `--brand-*` na seção nova.

## 8. E2E e revisão final

- [x] 8.1 `e2e/admin-publications.spec.ts` (novo): criar rascunho, sugestão de 15 dias para
      proclamas, publicar e aparecer na home, arquivar manualmente e sumir da home e da aba "No
      site". O cenário `staff` sem `content.publish` fica documentado como fora de alcance no
      próprio arquivo: não existe fixture de e2e para login como `staff` neste repositório (o seed
      só cria `admin`), mesma lacuna e mesma resolução já registradas em
      `e2e/admin-service-requests.spec.ts`; a distinção em si já está provada em
      `src/core/auth/roles.test.ts`.
- [x] 8.2 Conferir que a home some a seção quando a última publicação vigente é arquivada — coberto
      pelo último cenário de `e2e/admin-publications.spec.ts`.
- [x] 8.3 Conferir que nenhuma cor sai de `--color-admin-*`/`--brand-*` nas telas novas
      (`pnpm check:tokens`) — `node scripts/check-tokens.mjs` ok.
- [x] 8.4 `openspec validate add-office-publications --strict` antes do archive.
