## Context

`/editais` já existe como rota pública gateada por atribuição (`SECTION_REQUIRES.editais`), com
"setores" de aviso (`noticeSectors`: proclamas/RCPN, registro de imóveis/RI, protesto/PROTESTO,
RTD, RCPJ) — mas é só `ComingSoon`, sem conteúdo real por trás. É tentador ler essa rota como "a"
tela de publicações e simplesmente preenchê-la. Não é isso que o design importado (`Redesign 08`,
tela 8b) desenha: o admin gerencia proclamas/aviso/edital com vigência por data, e a
pré-visualização mostra o resultado como um bloco dentro do site, não como uma página de setores
por atribuição. São dois conceitos com o mesmo nome em português ("editais") e propósitos
diferentes — este design trata só do segundo, e documenta a distinção para quem ler os dois depois
não pensar que um substitui o outro.

O padrão já existente para "conteúdo que o painel edita e o site público lê" é `tenantContent`
(chave-valor, uma linha por `tenant_slug` + `key`, colunas `draft`/`published` separadas). Ele
serve bem para conteúdo singular (contato, marca, DPO — um valor por chave). Publicação é uma
lista, não um valor: múltiplas proclamas/avisos coexistem, cada um com sua própria data de entrada
e saída, editado e arquivado independentemente. Forçar isso em uma linha de `tenantContent`
significaria guardar um array inteiro num campo `jsonb` e reescrevê-lo por completo a cada edição
— o mesmo problema que `add-admin-service-requests` já rejeitou para exigência.

## Goals / Non-Goals

**Goals:**
- As quatro telas do design (lista em abas, formulário, pré-visualização, seção pública)
  funcionando com dado real.
- Vigência inteiramente por data, sem tarefa agendada nem ação manual para uma publicação sair no
  prazo.
- Vocabulário de rascunho/publicação já usado no projeto (`content.edit` vs `content.publish`)
  reaproveitado, não reinventado.

**Non-Goals:**
- Substituir ou preencher `/editais` — ver Context.
- Anexo, versionamento ou notificação de mudança (ver proposal.md, Non-Goals).

## Decisions

### Tabela própria, não `tenantContent`

`officePublications`: `id`, `tenantSlug`, `kind` (`marriageBanns` | `notice` | `publicNotice` —
proclamas, aviso, edital, respeitando o glossário do projeto), `title`, `body`, `publishAt`
(`date`, nulo enquanto rascunho), `expireAt` (`date`, obrigatório quando `publishAt` é
preenchido), `archivedAt` (nulo até arquivamento manual), `createdBy`, `createdAt`, `updatedAt`.
Index em `(tenant_slug, publish_at)` para a consulta pública (ordenar as vigentes, mais recente
primeiro).

### Estado é sempre calculado, nunca gravado por uma tarefa

Quatro estados, todos derivados de `publishAt`/`expireAt`/`archivedAt` na leitura — nenhuma
gravação automática:

| Estado | Condição |
|---|---|
| Rascunho | `publishAt IS NULL` |
| Agendada | `publishAt` no futuro, `archivedAt IS NULL` |
| No site | `publishAt <= hoje <= expireAt`, `archivedAt IS NULL` |
| Arquivada | `expireAt < hoje` OU `archivedAt IS NOT NULL` |

Diferente do fechamento por inatividade de `add-support-chat` (que precisa gravar uma mensagem de
sistema e um timestamp de fechamento — tem efeito colateral, então precisa de uma escrita
preguiçosa na leitura), aqui a "saída automática" não tem efeito colateral nenhum para gravar: o
estado é puramente uma função das datas. A consulta pública e a lista do painel calculam o mesmo
jeito (`publicationState(pub, today)`, em `src/core/publications`), sem escrita nenhuma. Mais
simples que o padrão do chat, e documentado aqui por que os dois casos parecidos merecem soluções
diferentes.

O design desenha três abas (No site, Agendadas, Arquivadas); "Rascunho" é uma quarta, adicionada
aqui porque o formulário do próprio design tem o botão "Salvar rascunho" — sem uma aba que liste o
resultado, esse botão levaria a um estado que ninguém acha depois, o mesmo problema que a regra de
navegação de `admin-shell` já nomeia ("link que não leva a lugar nenhum é pior que link ausente").

### `content.edit` rascunha, `content.publish` publica

`content.publish` já existe em `PERMISSIONS` (`src/core/auth/roles.ts`) mas nenhum papel o usa
hoje — `admin` o tem por herdar a lista inteira, `staff` não. Esta mudança é o primeiro uso real
dele: criar e editar uma publicação (incluindo mudar datas) exige só `content.edit` (admin +
staff); a ação que tira uma publicação do estado Rascunho — isto é, preencher `publishAt` pela
primeira vez — exige `content.publish` (só `admin`). Arquivar manualmente e editar uma publicação
já publicada continuam sob `content.edit`: só o primeiro "ao ar" é o ato de publicar.

Alternativa considerada: uma permissão nova `publications.manage`, no padrão de `requests.manage`.
Rejeitada — a distinção rascunho/publicado já é exatamente o par que `content.edit`/
`content.publish` foi desenhado para expressar (ver `tenantContent`, que já separa as duas
colunas); criar uma permissão paralela duplicaria um conceito que já existe e já está certo.

### Proclamas: 15 dias calculado no núcleo

`src/core/publications/expiry.ts`: `defaultExpiry(kind, publishAt)` devolve `publishAt + 15 dias`
quando `kind === "marriageBanns"`, e `undefined` (o operador escolhe) para os outros dois tipos.
Pura, sem I/O — o formulário chama para pré-preencher e o operador pode sobrescrever antes de
salvar; o servidor nunca recusa uma data diferente das sugeridas.

### Seção da home é um bloco condicional, não uma rota nem uma `Section`

"Proclamas e avisos" não ganha entrada em `SECTIONS`
(`src/core/tenant/schema.ts`) nem em `SECTION_REQUIRES`/`SECTION_ROUTES` — não é uma página, é um
bloco da própria home, como "Cidadão e transparência" já é (`citizenLinks.length > 0 && (...)` em
`src/app/(public)/page.tsx:268`). Não depende de atribuição: qualquer serventia pode publicar
independente do que tem delegado, então não há gate por `Attribution` aqui — só existência de
publicação vigente. A home busca as publicações `No site`, ordenadas por `publishAt` decrescente,
e não renderiza a seção quando a lista vem vazia.

## Risks / Trade-offs

- **Sem limite de quantas publicações aparecem na home** → uma serventia que nunca arquiva
  manualmente e publica muito acumula uma seção longa até os itens antigos expirarem sozinhos.
  Mitigação: a consulta já ordena por mais recente e um limite simples (ex. 6 mais recentes) é
  aceitável de adicionar sem migração — registrado aqui para quem tocar a consulta depois, mesmo
  raciocínio do "sem paginação" já aceito na fila de pedidos.
- **Editar sobrescreve sem histórico** → uma correção depois da publicação não deixa rastro do que
  mudou. Aceito como Non-Goal; `auditLog` já registra que uma edição aconteceu (ator, alvo, data),
  só não o diff do conteúdo.

## Migration Plan

Migração Drizzle única, aditiva: tabela nova `office_publications`. Nenhuma coluna removida ou
renomeada — não precisa dos dois deploys de migração destrutiva.
