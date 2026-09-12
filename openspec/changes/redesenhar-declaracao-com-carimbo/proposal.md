## Why

A declaração de hipossuficiência em PDF que o veridia gera hoje (change
`declaracao-hipossuficiencia-provimento-7`) cumpre os nove blocos do Anexo I do Provimento
CGJ/TJRN n. 7/2026, mas com o renderizador genérico do requerimento: rótulo e linha, um campo
por linha, caixas de marcação como texto `[X]`, sem as frases que o formulário oficial traz nos
blocos 6, 7 e 9, sem a opção "Outro ato com previsão legal", sem o telefone das testemunhas e
com uma base normativa própria no rodapé em vez da que o DJe publicou. A serventia vai entregar
esse papel como sendo o Anexo I, e ele precisa parecer e dizer o que o Anexo I diz.

Ao mesmo tempo, o cartório precisa desse documento como **prova perante o FCRCPN** (fundo de
compensação do registrador civil): quando o fundo audita uma serventia com muita gratuidade,
pede cópia de cada declaração, e uma declaração que chegou pelo site precisa dizer por onde veio,
quando foi aceita, por quem foi formalizada e sob qual autorização normativa a plataforma
recebeu o pedido. Hoje o PDF não certifica nada disso; a informação existe no banco (canal,
instante do aceite, quem assina) e não sai no papel. O texto institucional da "Plataforma
Eletrônica Oficial da Serventia" (art. 208, II, "b", do CNN-CNJ, redação do Provimento CNJ
n. 180/2024) foi redigido pela serventia para esse fim e não está em lugar nenhum do sistema.

O layout de referência foi fechado com a serventia (Design3.pdf): cartões numerados, campos em
colunas, caixas de marcação reais, avisos destacados, cabeçalho compacto na continuação, o
carimbo de certificação no fim e a base normativa oficial no rodapé.

## What Changes

- A declaração de hipossuficiência ganha um **modelo de conteúdo próprio** no core e um
  **renderizador de formulário** novo, fiel ao Design3: blocos numerados em cartão, campos lado a
  lado, caixas de marcação desenhadas (não mais `[X]` em texto), avisos "Antes de preencher" e
  "Proteção de dados" com o texto oficial, cabeçalho compacto da página 2 em diante, "Nº do
  pedido" no timbre e "Página X de Y" no rodapé. O requerimento e o comprovante de acesso não
  mudam de renderizador nem de aparência.
- O conteúdo passa a seguir o **Anexo I oficial** onde o PDF atual se afastava: "Outro ato com
  previsão legal" com o campo de descrição (sempre desmarcado quando gerado do pedido), tipo de
  certidão só como "Sem busca", "Com busca", "Inteiro teor", sem a base legal ao lado de cada
  ato no bloco 3, telefone ou e-mail das testemunhas, as frases fixas dos blocos 6, 7 e 9, bloco
  5 como "pessoa interessada", e a **base normativa** exatamente como publicada no DJe.
- Novo **carimbo de certificação de recebimento eletrônico**, depois do bloco 9 e visualmente
  separado dos nove blocos, rotulado "Emitida pela plataforma · Não integra o Anexo I". Só na
  declaração gerada de um pedido; nunca no formulário em branco. Traz canal (site oficial,
  balcão ou chat), data e hora do aceite, quem formalizou, protocolo, o texto institucional da
  plataforma com a remissão ao art. 208, II, "b" do CNN-CNJ e ao Provimento CNJ n. 180/2024, a
  linha "Autenticidade • Integridade • Segurança • Rastreabilidade", um **hash SHA-256 do
  conteúdo aceito** e o **endereço IP do aceite**.
- O rodapé da declaração gerada de um pedido ganha uma segunda linha: "Documento expedido pela
  Plataforma Eletrônica Oficial da Serventia · Provimento CNJ nº 180/2024 · Dados tratados
  conforme a LGPD (Lei nº 13.709/2018)". O formulário em branco não a traz.
- O aceite da declaração pelo site passa a **gravar o endereço IP** de quem aceitou, em
  `details.exemption`, ao lado da data que já é gravada. Só na gratuidade, não em todo pedido:
  é a declaração que o fundo audita. Finalidade e base legal ficam registradas nesta proposta
  (abaixo). O balcão não grava IP: o aceite presencial é o papel assinado.
- O hash impresso no carimbo é calculado no core sobre o conteúdo aceito (serventia, protocolo,
  instante do aceite, ato, tipo de certidão, beneficiários, texto da declaração e ciências), de
  forma determinística: quem tiver o pedido consegue recalcular e conferir. Não é hash dos bytes
  do PDF, que não pode conter o próprio hash.
- **BREAKING**: nenhuma. `details.exemption` cresce de forma aditiva; pedidos sem IP gravado
  imprimem a linha do IP em branco. As rotas, os nomes de arquivo, os botões e a auditoria
  continuam os mesmos.

### Tratamento do IP (LGPD)

O endereço IP do aceite é dado pessoal. Finalidade: comprovar, perante o FCRCPN e a
Corregedoria, que a declaração de hipossuficiência foi recebida por meio eletrônico num acesso
individual, na data e hora registradas. Base legal: cumprimento de obrigação legal e regulatória
pelo controlador (LGPD art. 7º, II; Provimento CNJ n. 213/2026, rastreabilidade) e exercício
regular de direitos (art. 7º, VI). Retenção: a do próprio pedido; a declaração já é anexo comum
do pedido e segue a política geral de retenção (change anterior, Non-Goals). Acesso: o mesmo do
pedido, chave de acesso do cidadão e sessão do painel.

## Capabilities

### New Capabilities
(nenhuma)

### Modified Capabilities
- `service-request`: o requirement "Declaração de hipossuficiência em PDF" é reescrito para o
  layout e o conteúdo fiéis ao Anexo I oficial e para o carimbo de certificação; o requirement
  "Formulário de declaração em branco disponível sem pedido" passa a exigir o mesmo layout, sem
  carimbo e sem a linha da plataforma; e entra o requirement novo "Registro do aceite eletrônico
  da declaração", que exige gravar o IP do aceite pelo site e calcular o hash do conteúdo
  aceito.

`admin-service-requests` não muda: o painel já imprime "o mesmo conteúdo do arquivo que o
cidadão baixa", e é esse conteúdo que muda.

## Impact

- `src/core/request/declaracao.ts`: passa a devolver um `DeclaracaoDocument` próprio (blocos
  numerados, grades de campos, listas de marcação, avisos, carimbo, rodapé), em vez de um
  `RequerimentoDocument`. Ganha `buildStamp` (carimbo) e o hash do aceite.
- Novo `src/core/request/acceptance.ts` (ou dentro de `declaracao.ts`): serialização canônica
  do conteúdo aceito e SHA-256.
- `src/core/request/kinds.ts`: `exemption.acceptance?: { ip?: string }`; `readExemption` lê.
- `src/core/acts/catalog.ts`: textos oficiais dos avisos e das frases fixas dos blocos 6, 7 e 9,
  ao lado de `FEE_EXEMPTION_DECLARATION`; base normativa oficial como constante.
- Novo `src/lib/pdf-form.ts`: renderizador do formulário (cartões, colunas, caixas, avisos,
  carimbo, cabeçalho de continuação, "Página X de Y"). `src/lib/pdf.ts` exporta o timbre, o QR e
  o rodapé para reuso e `renderDocuments` passa a aceitar a união dos dois tipos de documento.
- `src/lib/request-documents.ts`: monta o carimbo a partir de `details.channel`,
  `exemption.declaredAt`, `exemption.acceptance` e do protocolo.
- `src/app/(public)/solicitar/actions.ts`: lê o IP do primeiro salto de `x-forwarded-for` (mesma
  leitura de `src/lib/rate-limit.ts`, extraída para um helper) e grava em `acceptance`.
- Rotas de PDF (`solicitar/requerimento/route.ts`, `solicitar/requerimento/[arquivo]/route.ts`,
  `solicitar/declaracao-hipossuficiencia/route.ts`, `admin/pedidos/[protocolo]/imprimir/route.ts`):
  sem mudança de contrato; só passam a receber o tipo novo.
- Testes: `declaracao.test.ts` reescrito para o modelo novo; `kinds.test.ts` com `acceptance`;
  teste novo do hash; `catalog.test.ts` para os textos oficiais. E2e existentes continuam
  válidos (rotas, nomes de arquivo e auditoria não mudam).
- Sem migração de banco. Sem dependência nova: pdfkit já desenha retângulos, círculos e Times.

## Non-Goals

- **Congelar a declaração como anexo no protocolo.** O PDF continua sendo gerado a cada
  download, a partir do banco. O hash do conteúdo aceito dá ao fundo o que conferir sem arquivo
  guardado; gravar o PDF no blob no momento do protocolo é change à parte, se a serventia pedir.
- **Servir a via assinada pelo Gov.br em vez de gerar.** Lacuna já registrada na spec de
  `admin-service-requests` ("Via assinada quando ela existe"), independente desta change.
- **Redesenhar o requerimento e o comprovante de acesso.** Ficam com o renderizador atual.
- **O texto institucional no site** (rodapé, página "Sobre a plataforma" ou pop-up). É outra
  superfície, com decisão de UX própria; entra em change separada.
- **Gravar navegador (user agent) ou geolocalização.** Só o IP, que foi o que a serventia
  decidiu manter.
- **Gravar IP em pedidos sem gratuidade** ou nos aceites de LGPD e veracidade do requerimento.
- **Coletar "Outro ato com previsão legal" pelo site ou pelo balcão.** A opção existe no papel
  porque o Anexo I a tem; o catálogo continua oferecendo só os atos com base legal declarada.
- **Imprimir o CNS da serventia no bloco 1.** O tenant tem o dado, o Anexo I oficial não tem o
  campo.
- **Fonte embutida.** Títulos em Times-Bold e corpo em Helvetica, as fontes base do PDF, sem
  embutir a serifada do design.
