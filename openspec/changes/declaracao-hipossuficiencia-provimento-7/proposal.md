## Why

O Provimento n. 7, de 08/09/2026, da Corregedoria-Geral de Justiça do TJRN (em vigor na
publicação, com 15 dias para as serventias substituírem os formulários que usavam) instituiu o
formulário padrão de **declaração de hipossuficiência econômica** (Anexo I) para a gratuidade no
Registro Civil das Pessoas Naturais e fixou que a declaração, sozinha, basta (art. 5º). O fluxo
"Solicitar gratuidade (isento)" do veridia hoje é um checkbox com texto de CadÚnico e um anexo de
comprovante obrigatório: contradiz o Provimento no conteúdo da declaração, no pré-requisito do
anexo e na ausência de tudo que o Anexo I pede (beneficiário separado de quem assina,
representante legal, assinatura a rogo com testemunhas, certificação da serventia). Além disso o
balcão não consegue protocolar a gratuidade (o formulário de lançamento manual lista o ato mas não
tem os campos que o schema exige) e o painel só sabe que a gratuidade foi *pedida*, nunca qual foi
o desfecho.

Uma primeira tentativa (`adequar-gratuidade-provimento-7`, revertida no PR #99) leu errado a Lei
6.015 art. 30 e tirou a gratuidade da certidão de nascimento/óbito. O caput do art. 30 torna
gratuitos o registro e a **primeira** certidão; o §1º isenta os reconhecidamente pobres das
**demais** certidões mediante declaração (§2º), que é o caso de quase toda certidão pedida pelo
site. Esta change parte dessa leitura, confirmada pelo cartaz do Anexo II.

## What Changes

- A gratuidade continua sendo uma entrada própria na lista de atos do RCPN ("Solicitar gratuidade
  (isento)"), mas o seu miolo passa a ser a **declaração de hipossuficiência do Anexo I**, como
  dado estruturado do pedido: dados da pessoa beneficiária, ato-alvo (com o tipo de certidão
  quando for certidão), a declaração com as cinco ciências do bloco 4, quem formaliza (a própria
  pessoa, representante legal ou assinatura a rogo) e, no balcão, as duas testemunhas da
  assinatura a rogo.
- O texto da declaração deixa de falar em CadÚnico e programa social e passa a ser o do Anexo I
  (insuficiência de recursos sem prejuízo da manutenção própria e da família), com as ciências
  a–e. A lista `FEE_EXEMPTION_DOCUMENTS` e o bloqueio por ausência de anexo são removidos: anexar
  comprovante continua possível pelo campo de anexos comum, nunca exigido.
- Os atos-alvo passam a ser: certidão do RCPN (sem busca, com busca, inteiro teor), habilitação de
  casamento e **alteração de prenome** (`rcpn-alteracao-prenome`, renomeado para "Alteração de
  prenome" e marcado como isentável). A declaração é individual: na habilitação de casamento o
  site coleta uma declaração por nubente, no mesmo pedido.
- Novo documento em PDF, **a declaração de hipossuficiência**, que reproduz os nove blocos do
  Anexo I com a identidade visual do tenant: preenchida a partir do pedido (bloco 1 vem do tenant,
  bloco 9 fica para o oficial preencher à mão) e disponível ao cidadão pela chave de acesso e ao
  painel pela sessão, ao lado do requerimento; e em branco, sem pedido, no site e no painel (art.
  2º §1º e §4º).
- O lançamento manual do balcão ganha o bloco da gratuidade (ato-alvo, dados do beneficiário, quem
  assina, testemunhas quando a rogo) e passa a conseguir protocolar o ato. Corrige o bug atual em
  que o schema recusa o pedido em campos que a tela não tem.
- O painel ganha o **desfecho da gratuidade**: concedida, submetida ao Juízo Corregedor (art. 11),
  indeferida, ou substituída por parcelamento; com data, autor e auditoria, separado do andamento
  do pedido, já que o ato segue de imediato (art. 11 §3º).
- A lista de categorias de documento de transparência ganha "Cartaz de gratuidade e isenção", para
  a serventia publicar o Anexo II como já publica a tabela de emolumentos (art. 8º §2º).
- **BREAKING**: nenhuma. `details.exemption` cresce de forma aditiva; pedidos antigos, com só
  `declaredAt` e `actId`, continuam legíveis no painel, no requerimento e na nova declaração
  (que imprime o que sabe e deixa em branco o que não foi coletado).

## Non-Goals

- Integrar com o formulário eletrônico nacional (ON-RCPN/SERP, art. 1º §1º, II): plataforma do
  Operador Nacional, fora do veridia. O Anexo I estadual cobre os pedidos presenciais e o caso em
  que a plataforma nacional não está disponível (art. 2º §5º).
- Inserir "isento de emolumentos" no ato praticado (art. 10) ou emitir selo do tipo isento
  (art. 15): o veridia gera o requerimento e a declaração, não o ato ou a certidão final.
- Automatizar o encaminhamento ao Juízo (art. 11 §1º e §2º) ou a cobrança posterior (§4º): o
  painel só registra o desfecho.
- Coletar testemunhas no fluxo online: elas assinam fisicamente junto com quem assina a rogo, e
  só o balcão as conhece. Online, o cidadão informa quem assina a rogo; os blocos 8 e 9 saem em
  branco no papel.
- Oferecer "outro ato com previsão legal" como alvo da gratuidade: o catálogo só oferece o que
  tem base legal declarada; o caso raro vai por "Outro ato desta área" com descrição.
- Política própria de retenção e descarte da declaração (art. 13 §3º): ela é anexo comum do
  pedido, protegido pela chave de acesso e pela sessão como os demais; descarte segue a política
  geral de anexos.
- Rever o requisito de anexos comuns do pedido ou o valor (`amountCents`): conceder continua não
  zerando nada automaticamente.

## Capabilities

### New Capabilities
(nenhuma)

### Modified Capabilities
- `service-request`: o requirement "Solicitação de gratuidade (ISENTO) nos atos que a lei isenta"
  é reescrito: a declaração passa a ser a do Anexo I (dados do beneficiário, quem assina, cinco
  ciências), o anexo deixa de ser exigido, os atos-alvo ganham a alteração de prenome e o tipo de
  certidão, a habilitação exige uma declaração por nubente, e o cidadão baixa a declaração
  preenchida em PDF ao lado do requerimento; o formulário em branco fica disponível sem pedido.
- `admin-service-requests`: "Lançar pedido manualmente" passa a cobrir a gratuidade (bloco da
  declaração, testemunhas); "Imprimir o requerimento no balcão" ganha a declaração preenchida e a
  em branco; "Detalhe do pedido" ganha o desfecho da gratuidade com auditoria.

## Impact

- `src/core/acts/catalog.ts`: `FEE_EXEMPTION_DECLARATION` vira o texto do Anexo I;
  `FEE_EXEMPTION_DOCUMENTS` sai; `rcpn-alteracao-prenome` renomeado e com `feeExemption`; tipos
  de certidão como dado do ato-alvo.
- `src/core/request/kinds.ts`: `details.exemption` cresce (beneficiários, ato-alvo com tipo de
  certidão, signatário, testemunhas, desfecho); `readExemption` lê o formato antigo e o novo.
- `src/core/request/form.ts`, `src/app/(public)/solicitar/actions.ts` e `request-form.tsx`:
  campos novos, validação, remoção do bloqueio por anexo e do checklist de comprovantes; dois
  blocos de beneficiário na habilitação.
- Novo `src/core/request/declaracao.ts` (conteúdo da declaração, testável sem PDF) e extensão
  de `src/lib/pdf.ts` para desenhar os blocos com campos em branco; rotas de PDF pública
  (`solicitar/requerimento/route.ts`, `documento=declaracao`) e do painel
  (`pedidos/[protocolo]/imprimir/route.ts`), mais uma rota GET pública para o formulário em
  branco.
- `src/app/admin/(dashboard)/pedidos/novo/`: bloco da gratuidade no formulário manual e na
  action; `pedidos/[protocolo]/`: pill, ação e componente do desfecho;
  `src/lib/service-request.ts`: escrita do desfecho com auditoria.
- `src/core/transparency/documents.ts`: categoria nova.
- Testes: `catalog.test.ts`, `request.test.ts`, `requerimento.test.ts`, novo
  `declaracao.test.ts`, `kinds.test.ts`, `documents.test.ts`; e2e `service-request.spec.ts`
  (bloco da gratuidade) e `admin-service-requests.spec.ts` (balcão e desfecho).
- Sem migração de banco: tudo vive no jsonb `details` e em anexos já existentes.
