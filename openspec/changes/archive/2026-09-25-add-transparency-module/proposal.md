# Add Transparency Module

## Why

A página pública `/transparencia` é um "em breve" desde a fundação do site, mas a obrigação que ela cita é real: a LAI (Lei nº 12.527/2011) e a Resolução CNJ nº 215/2015 mandam a serventia expor tabelas de emolumentos e o movimento financeiro mensal. Hoje isso não existe em lugar nenhum do produto — nem o cidadão vê, nem a serventia tem onde publicar. O design aprovado (telas 10a e 10b do redesign) define as duas telas do painel que fecham essa lacuna.

## What Changes

- Novo módulo **Transparência** no painel admin (`/admin/transparencia`), com duas abas:
  - **Documentos** (10a): subir PDF com categoria, nome e ano/vigência; todo envio entra como rascunho; publicar/despublicar sem diálogo; remover é a única ação destrutiva (confirmada e auditada); setas movem a ordem da lista, que é a ordem do site.
  - **Boletim mensal** (10b): a serventia digita quatro valores (atos, arrecadação bruta, tributos, despesas), o saldo é **calculado, nunca digitado**; pré-visualização ao lado idêntica ao que sai no site; publicar como "Preliminar" (etiqueta dourada) ou "Consolidado"; consolidar substitui o boletim anterior do mesmo mês.
- A página pública `/transparencia` deixa de ser `ComingSoon` e passa a listar os documentos publicados (na ordem do painel) e os boletins mensais.
- Item **Transparência** na navegação lateral do admin, seção Serventia, entre Publicações e Configurações (posição que o mockup mostra).
- Boletim vira PDF gerado pelo servidor com a identidade do tenant (mesma infra PDFKit dos comprovantes), servido ao público.

## Capabilities

### New Capabilities

- `transparency-documents`: gestão de documentos públicos no painel (upload como rascunho, publicar/despublicar, remover com confirmação e auditoria, ordenação manual) e sua exibição na página pública.
- `transparency-bulletin`: boletim mensal de arrecadação — entrada dos quatro valores com saldo calculado, estados preliminar/consolidado, substituição do boletim do mês, PDF público com a marca do tenant.

### Modified Capabilities

_(nenhuma — as capacidades existentes não mudam de requisito; o item novo de navegação é detalhe de implementação do admin-shell)_

## Impact

- **Schema/migração**: duas tabelas novas (`transparency_documents`, `transparency_bulletins`). Migração gerada com `pnpm db:generate`, aplicada pelo usuário.
- **Código**: `src/app/admin/(dashboard)/transparencia/` (novo), `src/app/(public)/transparencia/page.tsx` (substitui ComingSoon), rota pública de PDF do boletim, `src/core/` para o cálculo do saldo e estados do boletim (puro, testado), `src/lib/` para queries.
- **Padrões obrigatórios já existentes**: botões `.btn` (docs/design-system.md), `<ConfirmAction>` para remover, `recordAudit` em toda deleção (check:destructive falha sem), uploads via `storeAttachments`, PDF via infra de `src/lib/pdf.ts`/palette.
- **Sem dependência nova.**
