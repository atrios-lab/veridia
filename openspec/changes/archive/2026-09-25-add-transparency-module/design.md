# Design — Transparency Module

## Context

O painel já tem um módulo com o mesmo formato de vida (Publicações: upload opcional, estados, arquivamento, auditoria), a infra de upload (`storeAttachments`, só PDF/imagem, limite por tamanho), a infra de PDF com identidade do tenant (`src/lib/pdf.ts` + `palette.ts`, PDFKit), o padrão de ação destrutiva (`<ConfirmAction>` + `recordAudit` + `check:destructive`) e o design system de botões (`docs/design-system.md`). As telas 10a/10b do redesign definem o layout. A página pública `/transparencia` é um `ComingSoon`.

Restrições do projeto que valem aqui: nenhum componente de biblioteca externa; Tailwind com tokens semânticos (check:tokens); migração sempre por arquivo gerado; `src/core/` puro e testado com `node --test`; deleção sem `recordAudit` falha o CI.

## Goals / Non-Goals

**Goals:**

- As duas abas do painel (Documentos, Boletim mensal) fiéis às telas 10a/10b.
- Página pública substituindo o ComingSoon, lendo os mesmos dados.
- Boletim como PDF do servidor com a marca do tenant.
- Saldo do boletim como função pura no core, em centavos, com teste.

**Non-Goals:**

- Drag-and-drop de reordenação (o mockup mostra o grip, mas as setas são o mecanismo definido: "as setas movem o documento sem diálogo"). O grip fica como afford visual futuro.
- Boletins importados de sistema contábil; a entrada é manual por definição da tela.
- Versionamento de documento (trocar o PDF = remover e subir outro).
- Paginação real na lista do painel ("Ver todos" expande a lista completa; sem infra de paginação).

## Decisions

**1. Duas tabelas novas, não reuso de `office_publications`.**
Publicações têm corpo de texto obrigatório, setor, expiração automática por data — nada disso existe aqui, e ordenação manual/estados draft-published-unpublished não existem lá. Esticar a tabela existente criaria colunas nulas dos dois lados. Tabelas: 

- `transparency_documents`: id, tenantSlug, category (text), title, yearLabel (text — "2026" ou "vigência 19/03/2026", texto livre como no mockup), colunas de arquivo iguais às de `office_publications` (storedName/displayName/path/mimeType/sizeBytes), `status` text (`draft` | `published` | `unpublished`), `position` integer, `unpublishedAt`, createdBy, createdAt, updatedAt. Índice (tenantSlug, position).
- `transparency_bulletins`: id, tenantSlug, `referenceMonth` date (dia 1 do mês), quatro inteiros em **centavos** (`actsCount` integer simples, `grossRevenueCents`, `taxesPaidCents`, `expensesCents` bigint), `status` (`preliminary` | `consolidated`), createdBy, createdAt, updatedAt. **Unique (tenantSlug, referenceMonth)** — a substituição do mês é um upsert, e o banco garante "nunca dois boletins do mesmo mês".

**2. Dinheiro em centavos, entrada em máscara pt-BR.**
`src/core/` ganha `transparency/bulletin.ts` com `parseMoneyBRL("48.230,10") → 4823010` e `bulletinBalance({gross, taxes, expenses}) → cents`, puros e testados. Float nunca toca dinheiro. O PDF e o preview formatam com `Intl.NumberFormat("pt-BR")`.

**3. Posição por inteiro com renumeração, não fração.**
Mover = trocar `position` com o vizinho na mesma transação; inserir = `max(position)+1`. Com dezenas de documentos por serventia, esquemas de fração/gap são complexidade sem retorno. Setas nos extremos desabilitadas no servidor (a ação verifica se existe vizinho).

**4. Preview do boletim é um componente React, o PDF é PDFKit — mesmos números, mesma função de formatação.**
O preview "como sai no site" renderiza em HTML com os tokens do tema (fiel o suficiente, ao vivo, sem servidor). O PDF público é gerado na rota com a infra existente. Os dois consomem o mesmo core (`bulletinBalance`, formatadores), então não divergem em conteúdo. Alternativa rejeitada: iframe do PDF real no painel — round-trip por tecla digitada.

**5. PDF gerado sob demanda na rota pública, não armazenado.**
Rota `GET /transparencia/boletim/[id]` do site público gera o PDF do boletim do tenant na hora (escopo por tenantSlug, 404 fora dele). Boletim é uma linha de números — regenerar custa nada e elimina arquivo órfão, storage e invalidação quando um consolidado substitui o preliminar.

**6. Publicar/despublicar sem diálogo; remover com `<ConfirmAction>`.**
Exatamente o texto da tela 10a. Remover deleta linha + `deleteStoredFile`, e o `recordAudit` fica dentro da função de dados que deleta (`transparency.document.delete`), como `deleteAttachment` — o check:destructive exige. Publicação/despublicação/upsert de boletim também auditam (`transparency.document.publish`, `.unpublish`, `transparency.bulletin.publish`), pelo mesmo motivo das publicações.

**7. Navegação e gating.**
Item "Transparência" na sidebar entre Publicações e Configurações. O link público já existe no rodapé. Sem flag de gating por tenant: transparência é obrigação legal de toda serventia, não recurso opcional.

## Risks / Trade-offs

- **[Preview HTML ≠ PDF pixel a pixel]** → aceito; a fidelidade prometida é de conteúdo e hierarquia, ambos saem do mesmo core. O teste de palette existente já cobre a paleta do PDF.
- **[Texto livre em `yearLabel`]** → é o que a tela pede ("Ex.: 2026 ou vigência 19/03/2026"); ordenar por ele nunca acontece — a ordem é manual.
- **[Corrida nas setas de ordenação]** → duas operadoras movendo ao mesmo tempo podem terminar com posições trocadas de forma inesperada, nunca corrompida (troca é transacional). Aceito para o tamanho de equipe de uma serventia.
- **[Upsert do boletim apaga o preliminar]** → é o comportamento pedido ("substitui o anterior do mesmo mês"); o histórico fica no audit_log.

## Migration Plan

1. `pnpm db:generate` cria a migração das duas tabelas; revisão linha a linha; commit junto.
2. `pnpm db:migrate` é executado pelo usuário (nunca pelo agente) — banco de dev é o de produção.
3. Deploy é só aditivo (tabelas novas, página pública trocando placeholder); rollback = reverter o deploy, tabelas ficam vazias sem efeito.

## Open Questions

- Categorias de documento: lista fixa começa com "Tabela de emolumentos", "Tabela de custas", "Aviso" — confirmar com a serventia se precisa de mais; adicionar é uma linha num array no core.
