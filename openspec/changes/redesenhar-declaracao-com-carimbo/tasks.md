## 1. Textos oficiais e do carimbo no core

- [x] 1.1 Em `src/core/acts/catalog.ts`, adicionar as constantes com o texto oficial do Anexo
  I: `ANEXO_I_NOTICE` ("Antes de preencher"), `ANEXO_I_DATA_PROTECTION`, `ANEXO_I_ACT_OPTIONS`
  (os quatro itens do bloco 3, na letra do DJe, com o mapeamento de `actId` para item),
  `ANEXO_I_REPRESENTATIVE_STATEMENT` (bloco 6), `ANEXO_I_ON_BEHALF_STATEMENT` (bloco 7),
  `ANEXO_I_PRESENCE_CERTIFICATION` (bloco 9) e `ANEXO_I_LEGAL_BASIS` (base normativa do
  rodapé, na ordem do DJe). Comentar em `FEE_EXEMPTION_DECLARATION` que mudar a redação
  invalida a conferência dos hashes antigos.
- [x] 1.2 Adicionar `PLATFORM_STATEMENT` (texto institucional: art. 208, II, "b" do CNN-CNJ,
  redação do Provimento CNJ n. 180/2024), `PLATFORM_RECEIPT_STATEMENT` (recebida
  eletronicamente mediante aceite do Anexo I), `PLATFORM_MOTTO` ("Autenticidade • Integridade •
  Segurança • Rastreabilidade") e `PLATFORM_FOOTER_LINE` (Documento expedido pela Plataforma…
  LGPD).
- [x] 1.3 Testes em `catalog.test.ts`: os quatro itens do bloco 3 batem com o oficial, os
  rótulos de certidão são "Sem busca"/"Com busca"/"Inteiro teor", nenhum texto da plataforma
  diz que o Provimento 7 autoriza a plataforma.

## 2. Aceite: IP e hash

- [x] 2.1 Em `src/core/request/kinds.ts`, adicionar `acceptance: z.object({ ip:
  z.string().optional() }).optional()` a `exemptionSchema`; `readExemption` devolve o campo.
  (Também: `readChannel`, novo, porque o carimbo precisa ler `details.channel`, que hoje
  nenhum lugar lê.)
- [x] 2.2 Novo `src/core/request/acceptance.ts` com `acceptanceHash(input)`: serialização
  canônica (chaves ordenadas) de tenantSlug, protocolNumber, declaredAt, actId,
  certificateType, beneficiários sem `witnesses`, `FEE_EXEMPTION_DECLARATION` e
  `FEE_EXEMPTION_ACKNOWLEDGEMENTS`, SHA-256 hex via `node:crypto`.
- [x] 2.3 Testes: `kinds.test.ts` lê `acceptance` e um pedido sem ele, e `readChannel`;
  `acceptance.test.ts` cobre determinismo, dois pedidos com os mesmos beneficiários dão
  hashes diferentes, testemunhas não alteram o hash.
- [x] 2.4 Novo `src/lib/client-ip.ts` com `clientIp(headers)` (primeiro salto de
  `x-forwarded-for`, ou `undefined`); `src/lib/rate-limit.ts` passa a usá-lo.
- [x] 2.5 Em `src/core/request/form.ts`, `buildExemptionDetails` aceita `acceptance?` e o grava;
  em `src/app/(public)/solicitar/actions.ts`, passar `{ ip: clientIp(requestHeaders) }` só
  quando há gratuidade. O balcão (`pedidos/novo/actions.ts`) não passa nada.
- [x] 2.6 Teste em `request.test.ts`: `buildExemptionDetails` com e sem `acceptance`.

## 3. Modelo de conteúdo da declaração

- [x] 3.1 Em `src/core/request/declaracao.ts`, definir `DeclaracaoDocument`, `FormBlock`,
  `FormContent`, `FormField` e `DeclaracaoStamp` conforme o design (decisão 1);
  `RequerimentoDocument` ganha `kind?: "requerimento"`.
- [x] 3.2 Reescrever `buildDeclaracao(tenant, act, exemption, beneficiaryIndex, meta)` para o
  modelo novo, com o conteúdo oficial (design, decisão 3): avisos, nove blocos, bloco 3 com os
  quatro itens e o tipo de certidão, blocos 6 e 7 condicionais quando há pedido e sempre
  presentes em branco, bloco 8 com telefone, frases fixas de 6, 7 e 9, base normativa, rodapé de
  uma ou duas linhas. `meta.stamps?: (DeclaracaoStamp|undefined)[]` (uma por beneficiário);
  quando presente no índice, o documento ganha o carimbo e a segunda linha do rodapé.
  `buildStamp(input)` também mora aqui: o hash é do pedido inteiro (todos os beneficiários),
  não por página, porque uma habilitação é um aceite só que produz duas declarações.
- [x] 3.3 `buildDeclaracoes` continua uma por beneficiário e repassa `meta.stamps[index]` a
  cada uma.
- [x] 3.4 Reescrever `src/core/request/declaracao.test.ts` para o modelo novo: formulário em
  branco (nove blocos, 6 e 7 presentes, sem carimbo, rodapé de uma linha); própria pessoa
  (marca o item certo, sem 6 e 7); certidão sem busca marca "Sem busca"; representante legal
  com a frase fixa; a rogo pelo site com testemunhas em branco e telefone; a rogo pelo balcão
  com testemunhas; habilitação gera dois documentos, carimbo igual nos dois (mesmo aceite);
  pedido v1 sai em branco menos ato e data; bloco 5 sem "aceite"/"eletrônico"; nem CadÚnico
  nem chave de acesso aparecem; `buildStamp` com canal, aceite, hash e IP presente/ausente.

## 4. Carimbo a partir do pedido

- [x] 4.1 `buildStamp` mora no core (`src/core/request/declaracao.ts`, ver 3.2), não em
  `request-documents.ts`: recebe `tenantSlug`, `protocolNumber`, `channel` (de
  `readChannel(stored.details)`), `exemption` e `beneficiaryIndex`, e não precisa de nada do
  `lib`. `request-documents.ts` só monta esses argumentos a partir de `stored` e `tenant`.
- [x] 4.2 `buildRequestDocuments` monta um carimbo por beneficiário (via `readChannel` +
  `buildStamp`) para `documento === "declaracao"` e nenhum para `"declaracao-em-branco"`;
  devolve `(RequerimentoDocument | DeclaracaoDocument)[]`.
- [x] 4.3 Teste de `buildStamp`: coberto em `declaracao.test.ts` (três canais, formalização
  própria/representante/a rogo, IP presente e ausente, hash de 64 hex) — fica no core porque
  é lá que a função mora. Não há teste dedicado de `buildRequestDocuments` (exigiria montar um
  `StoredRequest` inteiro, todo o schema de `service_requests`, para cobrir só a fiação de
  passar `stamps` ao `buildDeclaracoes`, já exercitada por dentro em `declaracao.test.ts`).

## 5. Renderizador de formulário

- [x] 5.1 Primitivas compartilhadas (`MARGIN`, `SEAL_SIZE`, `QR_SIZE`, `HEADER_BOTTOM`, `Pdf`,
  `contentWidth`, `bottom`, `drawEyebrow`) saíram de `pdf.ts` para `src/lib/pdf-primitives.ts`,
  que os dois renderizadores importam sem ciclo. `pdf.ts` exporta `renderQr`. O timbre do
  formulário (`drawLetterhead` em `pdf-form.ts`) é próprio: selo e nome à esquerda como nos
  outros documentos, e à direita o rótulo "Anexo I · Provimento CGJ/TJRN n. 7/2026" e a linha
  "Nº do pedido" (em branco no formulário avulso), sem QR, como no layout aprovado.
- [x] 5.2 Novo `src/lib/pdf-form.ts` com `drawFormDocumentBody(pdf, document, brand, qr)`:
  cartão de bloco (borda `palette.border`, faixa `palette.surface` com só os cantos de cima
  arredondados, badge circular `palette.primary`, título em Times-Bold, `hint` em versalete
  `palette.accent` à direita), grade de campos por frações, caixa de marcação vetorial 9 pt com
  "X", parágrafo, lista a) a e), linha de assinatura, quadrado tracejado, `aside` à direita de
  tudo que vem antes dele (Livro/Folha/Termo ao lado da lista e da descrição), avisos
  (`accentSoft` e `surface`), cabeçalho de continuação, carimbo (borda dupla `palette.primary`,
  badge, quatro fatos, parágrafos, hash em Courier numa linha própria, IP e lema na seguinte).
- [x] 5.3 Quebra de página por bloco inteiro: cada peça é medida (`draw: false`) antes de ser
  desenhada e, se não cabe acima do rodapé, abre página nova com o cabeçalho de continuação.
  Vale para avisos e carimbo. A margem inferior do PDFKit é zerada nessas páginas para ele
  nunca quebrar por conta própria.
- [x] 5.4 "Página X de Y": `bufferPages` ligado quando todos os documentos são formulários; o
  rodapé de cada documento é escrito numa passada final sobre as páginas dele
  (`switchToPage`), com a numeração reiniciando por documento (a habilitação sai "1 de 2" e
  "1 de 3" em cada nubente). Documentos de requerimento continuam com o rodapé no `pageAdded`,
  intocados.
- [x] 5.5 `renderDocuments` aceita `(RequerimentoDocument | DeclaracaoDocument)[]` e despacha
  por `kind`; as quatro rotas de PDF compilam sem mudança de contrato. `pnpm typecheck`, `pnpm
  lint`, `check:dashes` e `check:tokens` passam.

## 6. Fechamento

- [x] 6.1 `pnpm test` inteiro: 574 testes, 0 falhas (inclui `catalog.test.ts`, `kinds.test.ts`,
  `acceptance.test.ts`, `declaracao.test.ts`, `request.test.ts`).
- [x] 6.2 Conferência visual feita gerando os PDFs de verdade (script no scratchpad, `node
  --conditions=react-server` com um hook que resolve o alias `@/`) nas variações: site (própria
  pessoa, certidão sem busca, com IP), balcão (a rogo, testemunhas, sem IP), em branco, e
  habilitação (dois nubentes, um com representante legal). Conferido: bloco 3 na letra oficial,
  bloco 5 sem linha de aceite e sem impressão digital (ela é do bloco 7), blocos 6 e 7 só quando
  se aplicam no pedido e sempre no em branco, carimbo só nas preenchidas, rodapé de uma ou duas
  linhas, "Página X de Y" por documento, `Title` do PDF e nomes de arquivo inalterados. O site
  fecha em 2 páginas (título, aviso e blocos 1 a 4 na primeira; 5, proteção de dados, 8, 9 e
  carimbo na segunda), como o Design3. Balcão a rogo e o em branco vão a 3 páginas (bloco 7,
  ou 6 e 7, empurram o 9 e o carimbo), o caso que o design já dava como aceitável.
- [ ] 6.3 E2e `service-request.spec.ts` e `admin-service-requests.spec.ts`: não rodados aqui.
  O worktree não tem `.env.local`, o e2e faz `pnpm build` e escreve no Homolog, e o hook de
  push do repositório deixa o e2e para o CI de propósito ("CI is the gate for e2e"). O que
  esses specs conferem (rotas, `Content-Disposition`, nomes de arquivo, ações de auditoria)
  não foi tocado por esta change; fica para o CI do PR.
- [x] 6.4 Memória do projeto atualizada: o texto institucional no site continua pendente
  (change separada) e o hash do carimbo é do conteúdo aceito, não dos bytes do arquivo.
