## Context

A gratuidade do RCPN nasceu em duas changes arquivadas (`add-fee-exemption-request`,
`solicitar-gratuidade-como-ato`) como uma entrada própria na lista de atos, `gratuidade-rcpn`,
gerada por `exemptionAct()` em `src/core/acts/catalog.ts` a partir dos atos com `feeExemption`.
O formulário pergunta o ato-alvo (`exemptionActId`), pede um checkbox (`exemptionDeclaration`)
com o texto `FEE_EXEMPTION_DECLARATION` (CadÚnico, autorização de conferência em sistemas de
benefício) e recusa o envio sem anexo (`countAttachments` em `solicitar/actions.ts`). O que fica
gravado é `details.exemption = { declaredAt, actId }`; o requerimento (`requerimento.ts`) imprime
a declaração como um parágrafo; o painel mostra uma pill "Gratuidade solicitada (ISENTO)".

O Provimento CGJ/TJRN n. 7/2026 muda o conteúdo e a forma da declaração. O que ele exige e o que
o sistema precisa cobrir está no proposal. Três fatos de código pesam no desenho:

- `details` é jsonb validado só por Zod (`serviceRequestDetailsSchema`): campos novos são
  aditivos, sem migração.
- Documentos em PDF são montados como conteúdo puro no core (`RequerimentoDocument`) e desenhados
  por `renderDocument` em `src/lib/pdf.ts`, que só conhece seções de linhas e parágrafos. O Anexo
  I precisa de blocos numerados com **campos em branco para preencher à mão** (blocos 8 e 9, e
  qualquer campo não coletado), coisa que o renderizador não sabe desenhar.
- O balcão (`pedidos/novo`) valida com `serviceRequestSchema(act)`, que compartilha `actRules`
  com o site; hoje ele exige `exemptionActId`/`exemptionDeclaration` de um formulário que não os
  tem, e o ato fica inutilizável no balcão.

Decisões já tomadas com o usuário, que este design não reabre: a gratuidade continua porta
separada; a habilitação coleta as duas declarações online; o ato-alvo de prenome é só "Alteração
de prenome"; online coleta quem assina a rogo mas não as testemunhas; o desfecho é um campo do
painel; a declaração preenchida é anexo comum do pedido.

## Goals / Non-Goals

**Goals:**
- A declaração gravada no pedido carrega tudo que o Anexo I pede e o veridia consegue saber, num
  formato que o site, o balcão, o painel e o PDF leem do mesmo jeito.
- O Anexo I sai em PDF fiel aos nove blocos, preenchido ou em branco, sem que o core saiba de
  PDF.
- O balcão protocola a gratuidade com o mesmo schema do site, mais o que só o balcão sabe
  (testemunhas).
- O painel registra o desfecho com auditoria e o mostra onde a pill já está.

**Non-Goals:**
- Os do proposal (SERP, art. 10, selo isento, encaminhamento ao Juízo, testemunhas online,
  "outro ato" como alvo, retenção própria, valor do pedido).
- Refazer o renderizador de PDF em geral: só ganha o que a declaração precisa.
- Tornar a certidão de nascimento/óbito não isentável: pelo site ela é "demais certidões"
  (Lei 6.015 art. 30 §1º) e continua alvo da declaração.

## Decisions

### 1. A declaração é um objeto próprio em `details.exemption`, versão 2, lida por uma porta só

`details.exemption` passa de `{ declaredAt, actId }` para:

```
exemption: {
  declaredAt, actId,                           // como hoje
  certificateType?: "sem-busca" | "com-busca" | "inteiro-teor",
  beneficiaries: [{                            // 1, ou 2 na habilitação
    name, cpfOrId?, birthDate?, occupation?, address?, cityState?, zip?, contact?,
    signedBy: "self" | "legal-representative" | "on-behalf",
    signer?: { name, cpfOrId?, contact?, capacity?, proofDocument? },   // repr. legal ou a rogo
    witnesses?: [{ name, cpfOrId?, contact? }, { ... }],                // só a rogo, só balcão
  }],
  decision?: { outcome: "granted" | "referred" | "denied" | "installments",
               decidedAt, decidedBy },
}
```

`readExemption` continua sendo a única porta de leitura e passa a normalizar o formato antigo:
um pedido com só `declaredAt`/`actId` volta com `beneficiaries: []`, e todo leitor (pill,
requerimento, declaração em PDF) trata a lista vazia como "não coletado", imprimindo em branco.
Alternativa: tabela própria `exemption_declarations`. Descartada: o art. 13 pede acesso
restrito, e o jsonb do pedido já está atrás da sessão do painel e da chave de acesso do cidadão;
uma tabela nova só compraria consultas que ninguém faz (nada filtra por beneficiário) ao custo de
uma migração e de um segundo caminho de leitura.

`beneficiaries` é lista, e não um campo `secondBeneficiary`, porque o art. 4º diz "individual
por pessoa beneficiária" e a habilitação é só o primeiro caso com mais de uma; a lista fecha isso
sem outro campo depois. A regra "quantas declarações" vive no ato-alvo: `Act.feeExemption` ganha
`beneficiaryCount: 1 | 2` (habilitação = 2), e o schema exige exatamente esse número.

### 2. O texto da declaração e as ciências vivem no catálogo, como hoje, com o texto do Anexo I

`FEE_EXEMPTION_DECLARATION` passa a ser o parágrafo do bloco 4 ("não disponho de recursos
suficientes... sem prejuízo da minha manutenção e da manutenção de minha família") e ganha ao
lado `FEE_EXEMPTION_ACKNOWLEDGEMENTS`, as cinco ciências a–e, como lista. O checkbox do site e
do balcão passa a cobrir os dois (uma marcação, texto integral visível). `FEE_EXEMPTION_DOCUMENTS`
sai, junto com o bloco "Anexe o comprovante" e o bloqueio por anexo em `actions.ts`.
Alternativa: uma ciência por checkbox. Descartada: o Anexo I é uma assinatura só embaixo de tudo;
cinco checkboxes inventam um consentimento granular que o papel não tem.

### 3. `certificateType` é um campo da declaração, não três atos de catálogo

O bloco 3 do Anexo I pede o tipo da certidão (sem busca, com busca, inteiro teor) só quando o
ato-alvo é certidão. `Act.feeExemption` ganha `askCertificateType: true` em `rcpn-certidao`, e o
schema exige `certificateType` quando o alvo o pede e recusa quando não pede. Alternativa: três
itens de catálogo. Descartada pelo mesmo motivo que a change revertida já tinha descartado o
subtipo: são a mesma certidão, com o mesmo prazo e a mesma base legal; o tipo é um detalhe do
pedido, e o catálogo é a lista do que a serventia faz.

### 4. `rcpn-alteracao-prenome` vira "Alteração de prenome", isentável, sem mexer no `id`

O nome deixa de dizer "imotivada na maioridade" (o Anexo I e o cartaz falam em "alteração de
prenome"), o `id` fica, e o ato ganha `feeExemption` com base "Lei 6.015 art. 30 §1º; Provimento
CGJ/TJRN n. 7/2026, Anexo I". O `guidance` atual ("comparecimento pessoal") permanece: a
gratuidade é pedida online, o ato continua terminando no balcão.

### 5. A declaração é um documento próprio, com um tipo de seção novo para campos em branco

Novo `src/core/request/declaracao.ts` exporta `buildDeclaracao(tenant, act, exemption,
beneficiaryIndex, meta)` devolvendo um `RequerimentoDocument`, um por beneficiário (a habilitação
gera dois PDFs, ou um PDF com dois documentos concatenados; o design escolhe **um PDF, uma
declaração por página dupla**, porque é um arquivo só para assinar e devolver). `RequerimentoSection`
ganha `fields?: { label: string; value?: string }[]`: o renderizador desenha o rótulo e, quando
`value` está ausente, uma linha em branco na largura do campo; quando presente, o valor sobre a
linha. É o que permite o mesmo documento sair preenchido (site/balcão) ou em branco (formulário
avulso): o em branco é `buildDeclaracao` com `exemption` vazio.

Blocos: 1 (Serventia: `tenant.name`; Município/Comarca: `tenant.municipality`), 2 (beneficiário),
3 (ato-alvo marcado com ☒/☐ como texto, tipo de certidão, livro/folha/termo em branco), 4
(declaração e ciências), 5 (local/data em branco, assinatura: `signee`), 6 (representante legal,
preenchido só quando `signedBy === "legal-representative"`), 7 (a rogo, idem para
`"on-behalf"`), 8 (testemunhas, preenchidas quando o balcão as colheu), 9 (certificação da
presença, sempre em branco: é o oficial quem preenche à mão). Rodapé com a base normativa do
Anexo I. `signee` é o nome do beneficiário; quando a rogo, a linha de assinatura do bloco 7 é a
de quem assina, e a do bloco 5 recebe "impressão digital (se possível)", como no Anexo.

Alternativa: embutir o Anexo I no requerimento existente. Descartada: o art. 13 §1º diz que a
declaração não integra o conteúdo público nem acompanha certidões; separar o arquivo é o que
permite arquivá-la e descartá-la em separado, e é o que o balcão precisa (o requerimento se
imprime para qualquer ato; a declaração só para este).

### 6. Rotas de PDF: as existentes ganham `documento=declaracao`; o em branco ganha uma GET pública

- `POST /solicitar/requerimento` já escolhe entre requerimento e comprovante pelo campo
  `documento`; ganha o valor `declaracao`, com a mesma exigência de chave. A tela de sucesso e a
  consulta do protocolo oferecem o terceiro botão só quando o pedido tem `exemption`.
- `GET /admin/pedidos/[protocolo]/imprimir?documento=declaracao` no painel, mesma sessão e
  auditoria (`service-request.print.declaracao`).
- `GET /solicitar/declaracao-hipossuficiencia` público, sem estado, devolve o formulário em
  branco com a marca do tenant (art. 2º §1º: disponibilizado gratuitamente; §4º: preenchido
  previamente). O site linka a partir da tela do ato da gratuidade e da lista de atos do RCPN; o
  painel linka de `pedidos/novo` quando o ato escolhido é o da gratuidade.

### 7. O balcão coleta o que o site coleta, mais testemunhas, com o mesmo `actRules`

`actRules` passa a validar `beneficiaries` (número certo, `signedBy`, `signer` obrigatório quando
não é `self`), `certificateType` e a declaração marcada, tanto para `publicServiceRequestSchema`
quanto para `serviceRequestSchema`. A diferença entre os dois é uma opção `{ channel }`:
`witnesses` é aceito só no balcão e obrigatório lá quando `signedBy === "on-behalf"`; online é
recusado se vier. O formulário manual (`manual-entry-form.tsx`) ganha o bloco da gratuidade
renderizado quando `act.exemptionTargets` existe, com os mesmos nomes de campo do site, e a
action monta `details.exemption` como `solicitar/actions.ts` faz (extraído para um helper
`buildExemptionDetails` em `src/core/request/form.ts` para os dois usarem). Depois de protocolar,
a tela de sucesso do balcão oferece imprimir a declaração preenchida, ao lado do requerimento.

A serialização dos campos aninhados no `FormData` segue nomes planos indexados
(`beneficiary[0].name`, `beneficiary[0].signer.name`, `beneficiary[0].witness[1].name`), lidos
por um `readExemptionForm(formData)` único no core, para que site e balcão não divirjam na
leitura.

### 8. O desfecho é uma ação do detalhe, gravada no jsonb com auditoria, sem tocar no andamento

`setExemptionDecision(tenantSlug, id, outcome, actorId)` em `src/lib/service-request.ts` faz merge
de `exemption.decision` no `details` (mesmo padrão de `updateRequestData` com o telefone) e grava
`service-request.exemption-decision` na auditoria; o histórico do detalhe lista o evento. A UI é
um seletor ao lado da pill, com os quatro desfechos e "sem decisão" para desfazer, permitido só
com `requests.manage`. Nada muda `status` nem `amountCents`: o art. 11 §3º diz que o ato segue de
imediato, e conceder continua sendo decisão que o operador aplica no valor por conta própria. A
pill passa a dizer o desfecho quando há um ("Gratuidade concedida em 12/09/2026") e "Gratuidade
solicitada" quando não há.

### 9. Cartaz na transparência: uma linha

`DOCUMENT_CATEGORIES` ganha "Cartaz de gratuidade e isenção". Sem spec própria, como o comentário
do arquivo já prevê.

## Risks / Trade-offs

- [Formulário online da gratuidade cresce muito: dados de endereço, profissão, representante,
  dois beneficiários na habilitação] → Só o nome do beneficiário e a declaração são obrigatórios
  online; o resto do bloco 2 é opcional e sai em branco no papel para a pessoa completar. O bloco
  6/7 aparece só ao escolher representante ou a rogo. A habilitação mostra o segundo beneficiário
  como um bloco dobrável com o mesmo componente.
- [Renderizador de PDF ganha um tipo de seção e a fidelidade ao Anexo I fica por conta do desenho]
  → O conteúdo (rótulos, ordem, textos) é testado no core sem PDF; o desenho é conferido no
  navegador na tarefa de fechamento, comparado com o Anexo I do DJe.
- [Pedidos antigos com `exemption` v1 aparecem com declaração em branco] → É a verdade: nada foi
  coletado. A pill continua dizendo "solicitada em <data>", e a serventia imprime o Anexo I em
  branco para a pessoa preencher, que é o que ela faria de qualquer jeito.
- [Nomes de campo indexados no `FormData` são frágeis] → Um leitor único no core, testado com
  fixtures de site e de balcão.
- [Certidão de nascimento/óbito 1ª via não precisa de declaração e o site não distingue] →
  Texto de orientação na tela do ato-alvo: "O registro e a primeira certidão de nascimento e de
  óbito já são gratuitos para qualquer pessoa, sem esta declaração". Quem pede 1ª via está no
  balcão fazendo o registro, não no site.

## Migration Plan

Deploy único, sem banco: `details.exemption` cresce de forma aditiva e `readExemption` lê os dois
formatos. Rollback é reverter o deploy; pedidos gravados no formato novo continuariam sendo lidos
pelo `readExemption` antigo (ele só olha `declaredAt` e `actId`, que permanecem). A serventia
troca o formulário físico antigo pelo Anexo I em branco gerado pelo painel, dentro dos 15 dias do
art. 14.

## Open Questions

- O parcelamento (art. 11) é um desfecho de fato do Juízo, não da serventia; fica como opção do
  seletor por ser o que o Provimento nomeia. Se a serventia nunca usar, some numa change depois.
- O bloco 3 tem "Livro/Folha/Termo" para localizar o ato: sai em branco sempre, ou o site
  pergunta (opcional)? Este design deixa em branco; um campo opcional é adição barata se a
  serventia pedir.
