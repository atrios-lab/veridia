## Context

`asksPurpose(act, variantId)` decidia o campo de finalidade a partir de `Act.requiresPurpose`, salvo no verbum ad verbum do RCPN, onde dependia também da opção (óbito). O catálogo trava, em teste, que só três atos pedem finalidade: o verbum ad verbum, a busca e o documento arquivado de imóveis.

O inteiro teor de imóveis é uma opção de `ri-certidao-matricula`, ao lado da matrícula e do ônus. RTD, RCPJ e Notas tinham uma única certidão, sem opção.

## Goals / Non-Goals

**Goals:**

- Todo inteiro teor pedir o motivo, no site e no balcão, com a mesma regra.
- A certidão resumida continuar sem a pergunta.

**Non-Goals:**

- Os listados em "Non-goals" da proposta.

## Decisions

### O motivo é obrigatório também em imóveis

A Lei 6.015, art. 17, diz que a certidão pode ser pedida sem informar o motivo, e o CNN, art. 123, caput, pede em imóveis só a identificação de quem pede. O responsável pelo produto decidiu, em 07/11/2026, exigir o motivo em todo inteiro teor, inclusive o de imóveis, por causa dos dados sensíveis. A alternativa apresentada, motivo opcional, foi recusada.

A exigência fica só no inteiro teor. A matrícula, o ônus e as demais certidões resumidas continuam sem a pergunta, e um teste trava a lista.

### A opção pede o motivo, não o ato

Onde o inteiro teor divide o ato com certidões resumidas, a marca fica na opção: `ActVariant.requiresPurpose`. Marcar o ato pediria o motivo da matrícula e do ônus.

O papel de imóveis é um ato só de inteiro teor, então a marca fica no ato.

### Opções novas em RTD, RCPJ e Notas

RTD e RCPJ ganham "Certidão em breve relato" e "Certidão de inteiro teor". Notas ganha "Certidão de escritura, procuração ou ata notarial" e "Certidão de testamento". Os ids ficam em `details.actVariant`, sem migração. Pedidos antigos, sem opção, continuam aparecendo com o nome do ato.

Alternativa: atos novos, como o papel de imóveis. Descartada: o selo e o prazo são os mesmos da certidão resumida, e o ato próprio só se justificou no papel porque o selo mudava.

### Gratuidade com inteiro teor

A gratuidade é um ato sintético, e a opção e o tipo de certidão pertencem ao ato pedido (`rcpn-certidao`). `asksPurpose` recebe, além da opção, o ato da gratuidade e o tipo de certidão. A opção de óbito de `rcpn-certidao` ganha `waivesRequesterQualification`, a mesma marca do verbum ad verbum, para a gratuidade seguir os arts. 118 e 119 do CNN.

No site e no balcão, o campo aparece dentro do bloco da gratuidade, depois do tipo de certidão que o decide.

### Um texto só para o campo

`PURPOSE_LABEL`, `PURPOSE_PLACEHOLDER` e `PURPOSE_HINT` ficam no catálogo, usados no site, no balcão, no painel e no PDF. O rótulo passa de "Finalidade" para "Motivo do pedido", a palavra que quem pede entende. Vale também para a busca e o documento arquivado de imóveis, que já pediam finalidade.

### O motivo que não foi perguntado é recusado

`actRules` passa a recusar o motivo em pedido que não o pergunta, como já recusa as perguntas de quem pede. O site limpa o campo quando ele some, para quem troca do inteiro teor para a matrícula não ficar preso num erro.

## Risks / Trade-offs

- **Art. 17 em imóveis** → a serventia pode receber questionamento de quem pede o inteiro teor da matrícula. A decisão é do responsável pelo produto, e fica registrada aqui e no comentário do catálogo.
- **Pedido antigo de RTD, RCPJ ou Notas sem opção** → aparece com o nome do ato, e o operador pode escolher a opção no detalhe.
- **Duas opções a mais nas listas** → os nomes dizem a diferença.

## Open Questions

- **Testamento em vida:** o art. 547 do Provimento 156/2016-CGJ/RN não foi lido nesta mudança. O site não diz quem pode pedir, e a serventia analisa.
