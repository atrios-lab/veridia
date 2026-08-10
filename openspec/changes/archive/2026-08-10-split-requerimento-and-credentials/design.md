## Context

A mudança anterior (`restyle-requerimento-pdf`) tirou a chave de acesso do corpo do requerimento e a
colocou numa última página destacável. Naquele desenho, dois arquivos foram considerados e
descartados: "dobra as rotas, o download e a explicação na tela de sucesso, para resolver o mesmo
problema que uma página destacável resolve".

Esse julgamento estava errado num ponto concreto: **destacar é um gesto de papel**. O caminho que a
plataforma recomenda primeiro é o Gov.br, e assinar no Gov.br assina o PDF inteiro. O cidadão que
segue o caminho recomendado devolve à serventia um arquivo assinado com a credencial dentro — e o
arquivo assinado é justamente o que circula: fica anexado ao pedido, é lido no balcão, pode ser
reencaminhado. A página separada protege quem imprime e não protege quem assina digitalmente.

Estado atual do código: `buildRequerimento` (em `src/core/request/requerimento.ts`) devolve um
`RequerimentoDocument` com um campo `credentials`; `renderDocument` (em `src/lib/pdf.ts`) desenha o
corpo e, se houver `credentials`, chama `addPage()` e desenha o cartão com protocolo e chave. Uma
única rota, `POST /solicitar/requerimento`, verifica a chave e devolve o arquivo. Três lugares na
interface oferecem esse download: a tela de sucesso (`request-form.tsx`) e dois blocos da consulta
de protocolo (`protocol-lookup.tsx`).

O custo que o desenho anterior temia é real e continua de pé: são dois arquivos para o cidadão
gerenciar, e um deles é fácil de ignorar. A mitigação é a mesma de antes — a chave também aparece na
tela, uma vez, com destaque — e agora some o modo de falha silencioso, que era assinar sem perceber
o que ia junto.

## Goals / Non-Goals

**Goals:**
- O arquivo que se assina nunca contém a chave, por construção, não por gesto do cidadão.
- O comprovante de acesso é um documento reconhecível: papel timbrado da serventia, não um recorte.
- Onde havia um botão de download, passa a haver dois, nos três pontos da interface.
- O núcleo continua puro: os dois documentos são montados sem PDF à vista, e testáveis assim.

**Non-Goals:**
- Mudar texto legal, campos, identidade visual, rotas de autenticação ou armazenamento da chave.
- ZIP, download duplo automático, ou envio da chave por e-mail.
- Mexer no recibo do Encarregado (LGPD).

## Decisions

### 1. Um documento novo no núcleo, não um recorte do antigo

`buildRequerimento` deixa de preencher `credentials`. Surge:

```ts
export function buildAccessReceipt(
  tenant: Tenant,
  data: AccessReceiptData,   // protocolNumber, accessKey, createdAt
): RequerimentoDocument
```

Devolve o mesmo tipo dos outros documentos: `eyebrow`, `title` ("Comprovante de acesso"), `subtitle`
(protocolo · data), `office`, `footer` e o bloco `credentials` com as duas linhas e a nota. Sem
`sections` e sem `signee`: não há o que assinar num comprovante.

Reusar `RequerimentoDocument` é o que faz o comprovante herdar o papel timbrado, o selo, o QR e o
rodapé sem uma linha de desenho nova.

*Alternativa descartada:* `buildRequerimento` devolver os dois documentos de uma vez. Amarra quem
quer só um a montar os dois, e a rota pede um de cada vez.

### 2. Um parâmetro na rota que já existe, não uma rota nova

`POST /solicitar/requerimento` passa a ler um campo `documento` do corpo, com dois valores aceitos
(`requerimento`, o padrão, e `comprovante`), e escolhe o que montar e como nomear o arquivo.

A verificação da chave — buscar pelo protocolo, comparar o hash, responder 404 igual para "não
existe" e "chave errada" — é a parte cara e delicada, e é idêntica nos dois casos. Duplicá-la em uma
segunda rota é como uma dessas cópias fica para trás no dia em que a regra mudar.

*Alternativa descartada:* `POST /solicitar/comprovante` como rota própria, com um helper
compartilhado para a verificação. Mesmo resultado, mais um arquivo e mais um lugar por onde a
resposta 404 pode divergir. Se um dia os dois documentos precisarem de regras de acesso diferentes,
aí a rota separada se paga.

Um valor desconhecido em `documento` cai no padrão (requerimento), e não em erro: o campo é escolha
de formato, não credencial, e a proteção do download não depende dele.

### 3. `credentials` deixa de forçar página nova

Em `renderDocument`, o bloco `credentials` passa a ser desenhado no fluxo da página corrente, sem
`addPage()`. No comprovante, que não tem `sections`, ele cai logo abaixo do timbre — que é onde deve
estar num documento de uma página só.

O `addPage()` existia porque o bloco era um apêndice de outro documento. Não é mais.

### 4. O comprovante é emitido uma vez, na tela de sucesso

O comprovante aparece **só** no passo 2 da tela de sucesso, ao lado do requerimento: sólido para o
requerimento, contornado para "Baixar comprovante". A consulta de protocolo continua oferecendo
apenas o requerimento, nos dois lugares em que já o oferecia.

O motivo é ciclo de vida do documento, não sigilo: o comprovante é entregue no momento em que o
pedido nasce, ou pelo balcão quando a serventia emite o serviço. A consulta é uma tela em que se
entra digitando a chave — reemitir ali o documento que carrega a chave transforma um comprovante de
guarda única em algo que se baixa de novo a qualquer hora, o oposto do que "guarde este arquivo"
pede.

Vale ser explícito sobre o que isso **não** é: não é controle de acesso. A rota exige protocolo e
chave e devolve protocolo e chave — quem consegue pedir o comprovante já provou saber tudo que ele
contém, então não há nada a escalar. O princípio "esconder botão não é controle de acesso" vale para
botão que guarda dado que o usuário não deveria ver; não é o caso aqui.

Como cada download é um `<form method="post">` com os campos ocultos, o segundo botão é um segundo
form com o campo `documento` preenchido — nada de estado novo no cliente.

### 5. Microcopy: duas frases deixam de ser verdade

A tela de sucesso diz hoje que a chave "também vai impressa no PDF do requerimento", e a nota do
comprovante manda "destacar esta página antes de enviar o requerimento assinado". As duas descrevem
o desenho antigo e passam a mentir. A nota do comprovante perde a instrução de destacar e mantém o
resto (guardar; o site não mostra de novo; se perder, peça à serventia).

## Risks / Trade-offs

- **O cidadão baixa só o requerimento e perde a chave** → a chave aparece na tela com destaque no
  momento do registro, o passo 1 aponta o arquivo, e a consulta de protocolo já oferece o caminho de
  recuperação pela serventia. Continua sendo o risco central da mudança, e é o preço de não vazar a
  credencial no arquivo assinado.
- **Dois botões viram ruído em três telas** → hierarquia visual resolve: sólido para o requerimento,
  contornado para o comprovante, sempre nessa ordem, para que o par leia como "o principal e o
  extra" e não como duas escolhas equivalentes.
- **PDFs antigos, já baixados, ainda têm a chave na última página** → nada a fazer sobre arquivos
  emitidos; baixar de novo pelo protocolo passa a dar o formato novo.
- **Testes que procuram a chave em `credentials` do requerimento passam a falhar** → é o
  comportamento desejado, e eles mudam de alvo para o documento novo.

## Migration Plan

Deploy único. Sem migração de banco, sem mudança de contrato de autenticação. Rollback é reverter o
commit: os downloads voltam ao arquivo único e nada persistido depende do formato.

## Open Questions

- Vale oferecer o comprovante também para quem já tem o pedido antigo e nunca viu a página
  destacável? Como a rota é a mesma e a chave é exigida do mesmo jeito, isso já funciona de graça:
  qualquer pedido com chave válida gera o comprovante.
