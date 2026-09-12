## Context

`attachSignedForm` (`solicitar/actions.ts`) é uma action só, usada pela tela de sucesso e pela
consulta do protocolo: recebe um arquivo no campo `requerimento`, grava com `kind:
"requerimento-assinado"` (vira o `displayName`) e liga ao pedido como anexo `signed-form`,
`limit: 1`. A consulta (`protocolo/actions.ts`) acha o `signed-form` e expõe
`hasSignedForm`, `signedFormReceivedAt` e `signedFormAttachmentId`. No painel, o detalhe lista
os anexos do cidadão (`kind !== "office"`) com `AttachmentRow`, que abre `/admin/documento?
requestId&attachmentId`; o cabeçalho tem "Imprimir requerimento", "Baixar declaração" e
"Declaração em branco", todos apontando para a rota `imprimir`, que sempre gera. A rota
`imprimir` registra auditoria; a rota `documento` não.

## Decisions

### 1. Dois campos, um anexo por documento, distinguidos pelo `displayName`

O cidadão vê "Requerimento assinado" e, com gratuidade, "Declaração assinada", cada um com o
seu botão. `attachSignedForm` ganha o campo `documento` (`requerimento` | `declaracao`) e grava
`displayName` `requerimento-assinado` ou `declaracao-assinada`; o `kind` do anexo continua
`signed-form` para os dois, porque tudo que lê `signed-form` hoje (visão geral, "último
contato do cidadão") deve continuar contando os dois. `declaracao` é recusado em pedido sem
gratuidade. Alternativa: um campo só, múltiplos arquivos, e o painel descobre pelo conteúdo.
Descartada: o sistema não lê PDF, e "descobrir" seria chutar. Alternativa: um `kind` novo
`signed-declaration`. Descartada: cada leitor de `signed-form` teria que aprender o segundo,
e o `displayName` já é a etiqueta que o painel mostra.

### 2. O mais recente de cada tipo é a via assinada

Um reenvio (arquivo errado na primeira) tem que valer; a consulta já faz isso para o
comprovante de pagamento (`.at(-1)`). `signedFormFor(attachments, "requerimento-assinado")`
no core (`src/core/request/attachment.ts`), usado pela consulta e pelo painel, para os dois
não divergirem sobre qual arquivo é "a via".

### 3. No painel, a via assinada substitui a geração, e a geração vira secundária

Cabeçalho do detalhe: com `requerimento-assinado`, a ação principal é "Requerimento assinado"
(link para `/admin/documento`), e "Gerar sem assinatura" leva à rota `imprimir`; sem ele, fica
"Imprimir requerimento" como hoje. Mesma regra para a declaração ("Declaração assinada" /
"Baixar declaração", secundária "Gerar sem assinatura"). "Declaração em branco" não muda. A
rota `/admin/documento` passa a registrar `service-request.print.requerimento-assinado` ou
`.declaracao-assinada` quando o anexo é `signed-form`, com `targetId` do pedido e o id do
anexo nos detalhes: é o rastro que a rota `imprimir` já deixa, estendido ao arquivo que agora
sai no lugar dela.

### 4. A consulta distingue os dois, sem obrigar ninguém

Timeline: "Aguardando requerimento assinado" e, com gratuidade, uma segunda linha "Aguardando
declaração assinada"; cada uma vira "recebido em <data>" ao chegar. Os dois continuam
opcionais (o pedido segue sem eles, como a spec já diz). O rebaixar de cada arquivo usa o id
que a consulta já expõe, agora um por documento.

### 5. O balcão marca o papel digitalizado como via assinada

O formulário de anexar da seção de anexos do painel ganha um seletor "Este arquivo é": documento
comum (hoje), requerimento assinado, declaração assinada. Escolhido um dos dois últimos, o anexo
entra como `signed-form` com o `displayName` certo, e o cabeçalho passa a oferecê-lo. É como o
papel assinado à mão no balcão vira a via assinada sem um caminho paralelo.

## Risks / Trade-offs

- [O cidadão manda os dois documentos num arquivo só, pelo campo do requerimento] → Aceito;
  o painel mostra "Requerimento assinado" e a declaração aparece dentro. A timeline continuará
  dizendo "Aguardando declaração assinada": o operador pode anexar o mesmo arquivo como
  declaração pelo balcão (decisão 5), ou ignorar. Não há como saber sem ler o PDF.
- [Anexo antigo `signed-form` com `displayName` de nome livre] → Todos os `signed-form`
  existentes vieram de `attachSignedForm`, com `requerimento-assinado`; conferir no Homolog
  antes de mergear e, se houver outro nome, tratá-lo como requerimento.
- [Dois botões parecidos no cabeçalho] → "Requerimento assinado" em destaque, "Gerar sem
  assinatura" em tom apagado; o e2e confere os dois.

## Migration Plan

Deploy único, sem banco. Rollback é reverter: anexos `declaracao-assinada` gravados nesse
meio-tempo continuam listados como anexos comuns do cidadão.
