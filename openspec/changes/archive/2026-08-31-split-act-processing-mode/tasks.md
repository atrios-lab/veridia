## 1. O modelo do ato

- [x] 1.1 Em `src/core/acts/catalog.ts`, tirar `identification` de `PROCESSING_MODES`, deixando `online` e `presential`, e corrigir o comentário que descreve o que o campo responde.
- [x] 1.2 Acrescentar `identificationOnly?: true` à interface `Act`, com comentário dizendo que ausente significa "pede documentos" e por que é opcional.
- [x] 1.3 Tirar a entrada `identification` de `PROCESSING_MODE_LABELS` e de `PROCESSING_MODE_HINTS`, e exportar o rótulo "Só identificação" para o novo sinalizador.
- [x] 1.4 Apagar a dica "o mais rápido: sem requerimento". Nenhum texto do catálogo pode prometer ato sem requerimento (ver `design.md`, decisão 3).

## 2. Os atos

- [x] 2.1 Trocar os sete atos hoje `identification` para `processingMode: "online"` com `identificationOnly: true`: as certidões de RCPN, notas, RI (matrícula e documento arquivado), RTD e RCPJ, mais a busca por indicador.
- [x] 2.2 Conferir que nenhum outro ato ficou sem modo válido, e que os 22 continuam declarados.

## 3. A exibição

- [x] 3.1 Em `src/app/(public)/solicitar/_components/badges.tsx`, `ProcessingBadge` passa a receber o ato e a desenhar de um a dois selos: o do modo, e "Só identificação" quando o ato o traz.
- [x] 3.2 Ajustar as três chamadas: etapa 2 (`page.tsx`), cabeçalho do formulário e tela de sucesso (`request-form.tsx`).
- [x] 3.3 Em `src/app/(public)/solicitar/actions.ts`, `processingLabel` foi **removido** em vez de mantido: ele era definido em dois pontos e nunca lido por ninguém. Campo morto carregando justamente o conceito que este change remodela.

## 4. Testes

- [x] 4.1 Teste de núcleo em `catalog.test.ts`: nenhum ato declara modo fora de `online` e `presential`, e os sete atos de certidão e busca trazem `identificationOnly`.
- [x] 4.2 Teste de núcleo: nenhum texto de `PROCESSING_MODE_LABELS` nem de `PROCESSING_MODE_HINTS` contém "sem requerimento". É a afirmação que originou o card, e um teste é mais barato que a memória de todo mundo.
- [x] 4.3 Teste e2e: na etapa 2, uma certidão mostra "100% on-line" e "Só identificação"; um ato `presential` mostra só o dele.
- [x] 4.4 Rodar `pnpm typecheck`, `pnpm lint`, `pnpm test`, `check:dashes`, `check:tokens` e `check:a11y`. O e2e do wizard não toca banco até o envio, então roda aqui com `DATABASE_URL` vazio.

## 5. Fechamento

- [ ] 5.1 EM ABERTO, e de propósito: confirmar com a serventia a suposição da decisão 2. Alguma dessas sete certidões é entregue só no balcão? Se sim, ela nasce `presential` — uma linha por ato, sem migração.
- [x] 5.2 Abrir PR referenciando SCRUM-9, deixando escrito no corpo que a dica "sem requerimento" era falsa contra o próprio fluxo.
- [x] 5.3 Depois do merge, `openspec archive split-act-processing-mode`.
