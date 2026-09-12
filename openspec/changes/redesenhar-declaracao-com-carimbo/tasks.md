## 1. Textos oficiais e do carimbo no core

- [ ] 1.1 Em `src/core/acts/catalog.ts`, adicionar as constantes com o texto oficial do Anexo
  I: `ANEXO_I_NOTICE` ("Antes de preencher"), `ANEXO_I_DATA_PROTECTION`, `ANEXO_I_ACT_OPTIONS`
  (os quatro itens do bloco 3, na letra do DJe, com o mapeamento de `actId` para item),
  `ANEXO_I_REPRESENTATIVE_STATEMENT` (bloco 6), `ANEXO_I_ON_BEHALF_STATEMENT` (bloco 7),
  `ANEXO_I_PRESENCE_CERTIFICATION` (bloco 9) e `ANEXO_I_LEGAL_BASIS` (base normativa do
  rodapé, na ordem do DJe). Comentar em `FEE_EXEMPTION_DECLARATION` que mudar a redação
  invalida a conferência dos hashes antigos.
- [ ] 1.2 Adicionar `PLATFORM_STATEMENT` (texto institucional: art. 208, II, "b" do CNN-CNJ,
  redação do Provimento CNJ n. 180/2024), `PLATFORM_RECEIPT_STATEMENT` (recebida
  eletronicamente mediante aceite do Anexo I), `PLATFORM_MOTTO` ("Autenticidade • Integridade •
  Segurança • Rastreabilidade") e `PLATFORM_FOOTER_LINE` (Documento expedido pela Plataforma…
  LGPD).
- [ ] 1.3 Testes em `catalog.test.ts`: os quatro itens do bloco 3 batem com o oficial, os
  rótulos de certidão são "Sem busca"/"Com busca"/"Inteiro teor", nenhum texto da plataforma
  diz que o Provimento 7 autoriza a plataforma.

## 2. Aceite: IP e hash

- [ ] 2.1 Em `src/core/request/kinds.ts`, adicionar `acceptance: z.object({ ip:
  z.string().optional() }).optional()` a `exemptionSchema`; `readExemption` devolve o campo.
- [ ] 2.2 Novo `src/core/request/acceptance.ts` com `acceptanceHash(input)`: serialização
  canônica (chaves ordenadas) de tenantSlug, protocolNumber, declaredAt, actId,
  certificateType, beneficiários sem `witnesses`, `FEE_EXEMPTION_DECLARATION` e
  `FEE_EXEMPTION_ACKNOWLEDGEMENTS`, SHA-256 hex via `node:crypto`.
- [ ] 2.3 Testes: `kinds.test.ts` lê `acceptance` e um pedido sem ele; `acceptance.test.ts`
  cobre determinismo, dois pedidos com os mesmos beneficiários dão hashes diferentes,
  testemunhas e desfecho não alteram o hash, e a mudança do texto altera.
- [ ] 2.4 Novo `src/lib/client-ip.ts` com `clientIp(headers)` (primeiro salto de
  `x-forwarded-for`, ou `undefined`); `src/lib/rate-limit.ts` passa a usá-lo.
- [ ] 2.5 Em `src/core/request/form.ts`, `buildExemptionDetails` aceita `acceptance?` e o grava;
  em `src/app/(public)/solicitar/actions.ts`, passar `{ ip: clientIp(await headers()) }` só
  quando há gratuidade. O balcão (`pedidos/novo/actions.ts`) não passa nada.
- [ ] 2.6 Teste em `request.test.ts` (ou `form.test.ts`): `buildExemptionDetails` com e sem
  `acceptance`.

## 3. Modelo de conteúdo da declaração

- [ ] 3.1 Em `src/core/request/declaracao.ts`, definir `DeclaracaoDocument`, `FormBlock`,
  `FormContent`, `FormField` e `Stamp` conforme o design (decisão 1); `RequerimentoDocument`
  ganha `kind?: "requerimento"`.
- [ ] 3.2 Reescrever `buildDeclaracao(tenant, act, exemption, beneficiaryIndex, meta)` para o
  modelo novo, com o conteúdo oficial (design, decisão 3): avisos, nove blocos, bloco 3 com os
  quatro itens e o tipo de certidão, blocos 6 e 7 condicionais quando há pedido e sempre
  presentes em branco, bloco 8 com telefone, frases fixas de 6, 7 e 9, base normativa, rodapé de
  uma linha. `meta` ganha `stamp?: Stamp`; quando presente, o documento ganha o carimbo e a
  segunda linha do rodapé.
- [ ] 3.3 `buildDeclaracoes` continua uma por beneficiário e repassa o carimbo a cada uma, com
  "Formalizada por" do beneficiário da página.
- [ ] 3.4 Reescrever `src/core/request/declaracao.test.ts` para o modelo novo: formulário em
  branco (nove blocos, 6 e 7 presentes, sem carimbo, rodapé de uma linha); própria pessoa
  (marca o item certo, sem 6 e 7); certidão sem busca marca "Sem busca" e deixa "Outro ato"
  desmarcado; representante legal com a frase fixa; a rogo pelo site com testemunhas em
  branco e telefone; a rogo pelo balcão com testemunhas; habilitação gera dois documentos com
  carimbo em cada; pedido v1 sai em branco menos ato e data; bloco 5 não contém "aceite";
  nem CadÚnico nem chave de acesso aparecem.

## 4. Carimbo a partir do pedido

- [ ] 4.1 Em `src/lib/request-documents.ts`, `buildStamp(tenant, stored, exemption,
  beneficiaryIndex)`: canal por `details.channel` (ausente → "Site oficial da serventia",
  `counter` → "Balcão", `chat` → "Atendimento por chat"), "Recebida em" de `declaredAt` em
  `America/Fortaleza` no formato "dd/mm/aaaa às HH:MM", "Formalizada por" de `signedBy`,
  protocolo, `acceptanceHash`, `acceptance?.ip`, os textos de 1.2.
- [ ] 4.2 `buildRequestDocuments` passa o carimbo para `documento === "declaracao"` e nada para
  `"declaracao-em-branco"`; devolve `(RequerimentoDocument | DeclaracaoDocument)[]`.
- [ ] 4.3 Teste de `buildStamp` (mover a função para o core se ela não precisar de nada do lib,
  o que é o caso: recebe `stored.details`, `protocolNumber` e `createdAt`): três canais, três
  formas de formalizar, IP presente e ausente.

## 5. Renderizador de formulário

- [ ] 5.1 Em `src/lib/pdf.ts`, exportar `drawLetterhead`, `drawFooter`, a geração do QR e as
  constantes (`MARGIN`, `contentWidth`, `bottom`); `drawLetterhead` aceita a linha "Nº do
  pedido" e o rótulo do anexo à direita quando o documento os traz.
- [ ] 5.2 Novo `src/lib/pdf-form.ts` com `drawFormDocument(pdf, document, brand, qr)`: cartão
  de bloco (borda `palette.border`, faixa de cabeçalho `palette.surface`, badge circular
  `palette.primary`, título em Times-Bold, `hint` em versalete `palette.accent` à direita),
  grade de campos por frações, caixa de marcação vetorial 9 pt com "X", parágrafo, lista a–e,
  linha de assinatura, quadrado tracejado, `aside` (Livro/Folha/Termo), avisos (`accentSoft` e
  `surface`), cabeçalho de continuação, carimbo (borda dupla `palette.primary`, badge, fatos em
  duas linhas, parágrafos, hash em Courier 7 pt, IP, lema).
- [ ] 5.3 Quebra de página por bloco inteiro: medir a altura do bloco antes de desenhar; se não
  cabe, `addPage` com o cabeçalho de continuação. Mesmo para avisos e carimbo.
- [ ] 5.4 "Página X de Y": `bufferPages: true`, rodapé escrito numa passada final para os
  documentos de formulário; documentos de requerimento continuam com o rodapé no `pageAdded`.
- [ ] 5.5 `renderDocuments` aceita a união e despacha por `kind`; as quatro rotas de PDF compilam
  sem mudança de contrato. Verificar `pnpm tsc --noEmit` e Biome.

## 6. Fechamento

- [ ] 6.1 Rodar os testes tocados: `catalog.test.ts`, `kinds.test.ts`, `acceptance.test.ts`,
  `declaracao.test.ts`, `request.test.ts`, o teste de `buildStamp`.
- [ ] 6.2 Conferência visual contra o Design3 no navegador, nas três variações: pedido do site
  (própria pessoa, certidão sem busca), pedido do balcão a rogo com testemunhas, formulário em
  branco. Conferir: bloco 3 na letra oficial, bloco 5 sem linha de aceite, blocos 6 e 7
  ausentes/presentes conforme o caso, carimbo só nas preenchidas, rodapé de uma ou duas linhas,
  "Página X de Y", nome do arquivo e `Title` do PDF inalterados.
- [ ] 6.3 Rodar o e2e `service-request.spec.ts` e `admin-service-requests.spec.ts` (declaração)
  para confirmar que rotas, disposições e auditoria não mudaram.
- [ ] 6.4 Atualizar a memória do projeto: o texto institucional no site continua pendente
  (change separada) e o hash do carimbo é do conteúdo, não do arquivo.
