## Context

O formulário público valida com `publicServiceRequestSchema(act)` e as regras que dependem do ato
moram em `actRules`, aplicadas por `superRefine`. Os aceites de LGPD e veracidade já são gravados
com data em `details.consents`, porque um aceite validado e descartado não é prova (LGPD art. 8
§2). O jsonb `details` é a casa do que pertence só a este kind, parseado por
`serviceRequestDetailsSchema` na entrada e na saída — `phone` acabou de entrar lá pelo mesmo
caminho. Os anexos chegam de dois jeitos: arquivos no corpo (desenvolvimento) ou referências
`anexosRef` de upload direto ao blob (produção).

## Goals / Non-Goals

**Goals:**

- Um caminho declarado para o cidadão isento, com a exigência documental que o card pede.
- A declaração como prova guardada e como papel assinado, não como checkbox descartado.

**Non-Goals:**

- Zerar valor, integrar com sistemas de benefício, mudar o balcão (ver `proposal.md`).

## Decisions

### 1. A elegibilidade é do ato, no catálogo

`feeExemption?: { legalBasis: string }` na interface `Act`, presente só na certidão de RCPN e na
habilitação de casamento, cada um com sua base legal (são leis diferentes). Opcional como
`identificationOnly`: a maioria dos atos não isenta, e 20 declarações de ausência seriam ruído.

Alternativa descartada: configuração por tenant. A isenção é lei nacional, não política da
serventia — mesma razão de o catálogo inteiro ser config as code.

### 2. Dois campos no schema, amarrados por regra do ato

`exemptionRequested` e `exemptionDeclaration` (`z.coerce.boolean()`, como os aceites). Em
`actRules`: marcado sem declaração é erro na declaração; marcado num ato sem `feeExemption` é
erro no próprio campo — o servidor recusa o que o cliente nem deveria ter mostrado, porque
esconder o checkbox não é controle.

A declaração é um texto próprio, exportado do catálogo junto do sinalizador, com CP art. 299 e
CC arts. 186 e 927 escritos nele. Não reusa `truthDeclaration`: a genérica fala das informações
do pedido; esta autoriza conferência em sistema de governo e nomeia as penas. São consentimentos
diferentes e provas diferentes.

### 3. O anexo obrigatório é contado no FormData, antes de armazenar

A regra "pelo menos um anexo" não cabe no Zod do schema (os arquivos não passam por ele) nem
depois de `collectAttachments` (os blobs já estariam gravados quando a recusa saísse). A action
conta as entradas `anexos` com bytes e as `anexosRef` antes de armazenar qualquer coisa, e o
formulário aplica a mesma regra no cliente para recusar antes do upload — cortesia, como toda
validação de cliente aqui; o servidor decide.

### 4. `details.exemption = { declaredAt }`

Mesmo desenho de `consents`: a presença do objeto diz que a gratuidade foi solicitada e
`declaredAt` é a prova datada. Nada de coluna: é de um kind só, e ninguém filtra fila por
isenção hoje — se o painel um dia quiser a fila de isentos, aí se conversa sobre coluna.

### 5. O requerimento impresso carrega a declaração

`RequerimentoData` ganha o sinal e o PDF ganha a linha/seção da gratuidade com o texto da
declaração. É a parte juridicamente valiosa: o requerimento é o documento que o cidadão assina
(Gov.br ou punho), então a declaração de hipossuficiência sai de checkbox e vira assinatura.

## Risks / Trade-offs

- **Cidadão marca isenção sem direito.** → É exatamente o que a declaração cobre: a conferência é
  da serventia e as penas estão escritas. O site não julga, registra.
- **Exigir anexo cria atrito no ato mais pedido.** → Só quando a gratuidade é marcada; o pedido
  pagante continua com anexo opcional. E é o card que exige.
- **Texto legal errado é pior que nenhum.** → As bases estão citadas artigo por artigo na
  proposta e na spec para revisão de quem entende: CF art. 5º LXXVI, Lei 6.015 art. 30 §1º,
  CC art. 1.512 § único, CP art. 299, CC arts. 186 e 927. Confirmar com a serventia antes do
  merge é tarefa própria.

## Migration Plan

Nada a migrar: campo novo em jsonb, flag nova em config as code. Pedidos existentes não têm
`exemption` e são lidos como pedidos sem gratuidade, que é o que são. Rollback é reverter o
commit.

## Open Questions

- A serventia confirma as bases legais e o texto da declaração como escritos? (tarefa de
  fechamento; o texto sai em documento assinado, então a palavra final é do cartório)
