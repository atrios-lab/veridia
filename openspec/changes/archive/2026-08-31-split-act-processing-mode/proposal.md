## Why

O site diz ao cidadão que uma certidão não tem requerimento, e depois exige o requerimento
assinado. A dica do modo `identification` é literalmente "o mais rápido: sem requerimento", e a
tela de sucesso mostra "Baixe o requerimento e assine" e "Envie o requerimento assinado" para
todos os atos, sem exceção. Não é rótulo faltando: é informação errada, e o cartório reparou
(SCRUM-9).

A causa é o modelo. `processingMode` guarda duas perguntas diferentes num campo só:

- **o que a serventia precisa de você** — só o documento de identidade, ou papéis além dele;
- **se você precisa comparecer** — resolve tudo pela internet, ou termina no balcão.

Uma certidão responde as duas: pede só identificação **e** é 100% on-line. Como os três valores
são mutuamente exclusivos, o ato só pode dizer uma delas, e hoje diz a errada.

## What Changes

- `processingMode` passa a responder só a segunda pergunta, com dois valores: `online` e
  `presential`. O valor `identification` deixa de existir.
- Nasce `identificationOnly`, um sinalizador opcional para os atos que a serventia atende sem
  pedir papel nenhum além da identificação do requerente.
- Os sete atos hoje marcados `identification` passam a `online` com `identificationOnly: true`:
  as certidões das cinco atribuições e a busca por indicador.
- **A dica "sem requerimento" sai.** Ela é falsa para todo ato: o requerimento assinado é pedido
  na tela de sucesso de qualquer pedido feito pelo site.
- O card do ato passa a mostrar os dois fatos quando os dois valem: "100% on-line" e "Só
  identificação".

## Capabilities

### New Capabilities

Nenhuma. A mudança altera requisito de uma capacidade que já existe.

### Modified Capabilities

- `service-request`: o modo de tramitação de um ato deixa de ser um enum de três valores e passa
  a ser duas informações independentes; a exibição passa a mostrar as duas.

## Impact

- `src/core/acts/catalog.ts`: `PROCESSING_MODES`, os dois mapas de texto, a interface `Act` e os
  22 atos.
- `src/app/(public)/solicitar/`: o selo (`_components/badges.tsx`), a etapa 2 (`page.tsx`), o
  cabeçalho do formulário e a tela de sucesso (`request-form.tsx`), e o `processingLabel` que a
  action devolve (`actions.ts`).
- `src/core/acts/catalog.test.ts` e o e2e que afirma o selo.

## Non-Goals

- **A tela de sucesso não muda.** O requerimento continua sendo pedido para todo ato: quem estava
  errado era o texto do catálogo, não o fluxo. Se algum dia a serventia quiser dispensar o
  requerimento de fato, é outro card e outra conversa.
- Nenhum ato entra ou sai do catálogo, e nenhuma base legal muda.
- O modo não vira configuração por serventia: continua config as code, igual ao resto do catálogo.
- Não se mexe no lançamento de balcão, que não lê esse campo.
