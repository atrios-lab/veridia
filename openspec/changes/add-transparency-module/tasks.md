# Tasks — Transparency Module

## 1. Core e schema

- [x] 1.1 Criar `src/core/transparency/bulletin.ts`: `parseMoneyBRL`, `formatMoneyBRL`, `bulletinBalance` (centavos, puros) e as constantes de situação; teste `bulletin.test.ts` cobrindo centavos exatos, entrada malformada e o exemplo da tela (48.230,10 − 9.612,44 − 21.480,00 = 17.137,66)
- [x] 1.2 Criar `src/core/transparency/documents.ts`: categorias fixas, estados (`draft`/`published`/`unpublished`) e transições válidas; teste
- [x] 1.3 Adicionar `transparency_documents` e `transparency_bulletins` a `src/db/schema.ts` conforme design (unique tenant+mês no boletim, índice tenant+position nos documentos); `pnpm db:generate` e revisar o SQL linha a linha — **não** rodar `db:migrate` (usuário roda)
- [x] 1.4 Formulários zod derivados: `documentFormSchema` e `parseBulletinFigures` nos arquivos de core (padrão do projeto: form schema mora no core junto do domínio, como `publicationFormSchema`; `validation.ts` guarda shapes de linha do banco)

## 2. Camada de dados (`src/lib/transparency.ts`)

- [x] 2.1 Documentos: `listDocuments`/`publishedDocuments`, `createDocument` (draft, position = max+1), `publishDocument`/`unpublishDocument`, `moveDocument` (swap atômico por CASE num único statement — neon-http não tem transação interativa; no-op nos extremos), `deleteDocument` (linha + `recordAudit` na própria função)
- [x] 2.2 Auditoria: create/publish/unpublish/delete auditados; move **não** (só muda ordem, não conteúdo público, e é frequente) — decisão comentada no código
- [x] 2.3 Boletins: `upsertBulletin` (onConflictDoUpdate no unique tenant+mês; audit `transparency.bulletin.publish`), `listBulletins`, `getBulletin` escopado, `latestBulletin` para o cabeçalho

## 3. Painel — aba Documentos (tela 10a)

- [x] 3.1 Rota `/admin/transparencia` com header do padrão, abas Documentos/Boletim mensal (mesmo padrão de abas de Configurações) e item "Transparência" na sidebar entre Publicações e Configurações
- [x] 3.2 Lista: linha com grip decorativo, título + pill de estado (Rascunho dourada, Publicado verde, Despublicado neutra), metadados (categoria · ano/vigência · tamanho · quem/quando), setas ↑/↓ (desabilitadas nos extremos), Ver (abre PDF), Publicar/Despublicar/Publicar de novo conforme estado, Remover em `.btn-admin-danger` isolado à direita; rascunho com fundo destacado como no mockup
- [x] 3.3 "Mostrando N de M documentos" + "Ver todos" expandindo a lista; seletor "Todas as categorias"
- [x] 3.4 Formulário "Subir documento" no painel lateral: categoria (select), nome, ano/vigência, dropzone PDF (padrão dos dropzones existentes, "Só PDF, até 10 MB"), submit "Enviar como rascunho" `.btn-admin-primary btn-lg`
- [x] 3.5 Remover via `<ConfirmAction>` nomeando o documento na consequência

## 4. Painel — aba Boletim mensal (tela 10b)

- [x] 4.1 Formulário: mês (select pt-BR), ano, atos, arrecadação, tributos, despesas com máscara de moeda; "Saldo final (calculado)" em caixa verde, atualizado a cada tecla via core; toggle Preliminar/Consolidado (pill dupla, padrão dos toggles do painel) com a legenda da tela; "Publicar no site" `.btn-admin-primary btn-lg`
- [x] 4.2 Preview ao lado ("Pré-visualização do PDF · como sai no site"): cabeçalho escuro com marca + CNS, título "Boletim Mensal, <Mês> de <Ano>", período, blocos "De onde veio"/"Para onde foi", saldo em faixa escura, rodapé legal, etiqueta "Dados preliminares" quando preliminar — tudo consumindo o mesmo core do formulário
- [x] 4.3 "Boletins publicados" (mês/ano, pill de situação, Ver PDF) e "Último publicado" no cabeçalho do módulo
- [x] 4.4 Publicar mês que já existe substitui (upsert) — refletir na lista sem duplicar

## 5. Site público

- [x] 5.1 Substituir o ComingSoon de `/transparencia`: documentos publicados na ordem do painel (nome, categoria, vigência, tamanho, link) e boletins publicados (mês, etiqueta preliminar quando for, link para PDF); estados vazios explicativos
- [x] 5.2 Rota `GET /transparencia/boletim/[id]`: PDF gerado sob demanda com a infra de `src/lib/pdf.ts` (marca do tenant, quatro valores, saldo, rodapé legal, etiqueta preliminar); 404 fora do tenant
- [x] 5.3 Rota de download do documento público (arquivo servido com Content-Disposition correto para nome acentuado, padrão RFC 5987 já usado)

## 6. Verificação

- [x] 6.1 `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm check:tokens`, `pnpm check:dashes` (arquivos novos), `pnpm check:destructive`
- [x] 6.2 Verificação no browser (pós-migração, banco real, com o usuário logado): boletim ponta a ponta — saldo calculado R$ 17.137,66, preview fiel, publicar preliminar, PDF público válido, consolidar substituindo (uma linha, unique index). Documentos — lista com pills e fundo de rascunho, só publicados na pública, remover pelo diálogo modal + auditoria, mover (swap) e despublicar. Bugs pegos e corrigidos aqui: `moveDocument` (CASE precisava `::int`) e o layout do PDF do boletim (colunas colidindo por `pdf.y` compartilhado → coordenadas explícitas + cards). Dados de teste limpos (banco = produção).
- [x] 6.3 e2e: spec `admin-transparency.spec.ts` escrita no padrão dos existentes (gate de sessão + seed/cleanup por rótulos fixos, mês 2099 para nunca sobrescrever real). **Não executada** — depende de `DATABASE_URL` (prod) e da migração; skipa sem elas, como as demais specs.
