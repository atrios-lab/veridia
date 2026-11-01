## 0. Pré-requisito

- [ ] 0.1 Arquivar `via-assinada-no-painel` (implementada, 12/12) para os deltas desta change
  caírem sobre o texto dela.

## 1. Core

- [ ] 1.1 `src/core/request/signature.ts` (sem `node:crypto`): `normalizeSignatureName` (NFD
  sem diacríticos, minúsculas, espaços colapsados, sem espaço nas pontas) e
  `signatureNameMatches(typed, applicantName)`. Testes em `signature.test.ts`, incluindo
  "José Antônio" × "jose  antonio" (confere) e "Maria da Silva" × "Maria Souza" (não confere).
- [ ] 1.2 `REQUERIMENTO_DECLARATIONS` versionado em `src/core/acts/catalog.ts` (`"1"`: os
  dois parágrafos de hoje), e `buildRequerimento` lê dele em vez do array literal. O texto
  impresso não muda.
- [ ] 1.3 Tornar o JSON canônico de `acceptance.ts` compartilhável (exportar ou mover para um
  módulo próprio), sem mudar o hash da declaração: o teste atual de `acceptance.test.ts`
  continua passando com os mesmos valores.
- [ ] 1.4 `src/core/request/signature-hash.ts`: tipo `SignatureDetails` (`signedAt`,
  `typedName`, `ip?`, `textVersion`, `content`, `hash`), `buildSignedContent(...)` e
  `signatureHash(...)`. Testes: determinismo, protocolo e momento mudam o hash, dados de
  apresentação do tenant não entram, e o recálculo de uma assinatura de exemplo fixa bate com
  o hash gravado nela (protege contra mudar a canonicalização).
- [ ] 1.5 `requerimentoSignedState(details, attachments)` no core: anexo mais recente >
  eletrônica > ausente. Testes cobrindo pedido antigo, eletrônico, eletrônico mais Gov.br, e
  balcão com papel marcado.
- [ ] 1.6 Schema público (`src/core/request/form.ts`): campo `signatureName` obrigatório, com
  refinamento por `signatureNameMatches` e erro no campo ("Digite o nome do requerente como
  está acima: <nome>"). O schema do balcão não muda.

## 2. Carimbo

- [ ] 2.1 `DeclaracaoStamp` vira `CertificationStamp`, e `drawStamp` sai de `pdf-form.ts`
  para `pdf-primitives.ts`. A declaração continua com a mesma aparência: conferir o PDF
  gerado antes e depois.
- [ ] 2.2 Constantes do carimbo do requerimento em `catalog.ts` (`SIGNATURE_STATEMENT` e
  rótulos) e `buildSignatureStamp(signature, channel)` no core. Teste no catálogo: o texto do
  carimbo do requerimento não contém "14.063" nem "assinatura eletrônica simples" (Open
  Question 1).
- [ ] 2.3 `buildRequerimento` aceita `signature?`: com ela, as linhas de requerente e pedido
  saem de `signature.content`, o subtítulo usa `signedAt`, e `stamp` substitui `signature`
  (parágrafo de instrução). Sem ela, como hoje. Testes em `requerimento.test.ts`, incluindo
  "dados corrigidos depois não aparecem na via assinada".
- [ ] 2.4 `renderDocuments` (`src/lib/pdf.ts`) desenha o `stamp` no lugar do bloco de
  assinatura quando presente.

## 3. Gravação no submit

- [ ] 3.1 `createServiceRequestWith` (`src/lib/service-request.ts`) aceita `sign?:
  (protocolNumber) => SignatureDetails`, chamado dentro da transação de `createRecordWith`
  depois de gerado o protocolo, e grava o resultado em `details.signature` no mesmo insert.
  Teste em processo (PGlite): o pedido criado tem `details.signature` com o protocolo certo no
  conteúdo e hash recalculável.
- [ ] 3.2 `submitServiceRequest` (`solicitar/actions.ts`) lê `signatureName`, monta `sign` com
  `consentedAt`, o IP de `clientIp` e os dados validados, e passa adiante. A regra fica na
  função `...With` da 3.1. A action só faz o transporte.
- [ ] 3.3 Teste em processo: envio sem `signatureName` ou com nome que não confere não grava
  pedido. Lançamento pelo balcão não grava `details.signature`.

## 4. Site

- [ ] 4.1 `request-form.tsx`: bloco "Revise e assine" no fim da etapa 3, renderizando as
  seções de `buildRequerimento` com os valores do formulário e o protocolo como "atribuído no
  envio"; campo do nome com validação no cliente por `signatureNameMatches`; botão "Assinar e
  enviar pedido". Conferir que `signature-hash.ts` e `node:crypto` não entram no chunk do
  cliente, e comparar o tamanho do chunk de `/solicitar` antes e depois.
- [ ] 4.2 Tela de sucesso com assinatura: passos "Guarde o protocolo e a chave" e "Sua via
  assinada" (download do requerimento). Sem os passos de assinar e enviar o requerimento e sem
  `HANDWRITTEN_SIGNATURE_CAVEAT`. Com gratuidade, mantém o download e o envio da declaração.
- [ ] 4.3 `protocolo/actions.ts` e `protocol-lookup.tsx` leem `requerimentoSignedState`:
  linha "Requerimento assinado em <data>" concluída para o eletrônico; envio pelo Gov.br
  recolhido sob "Prefere assinar pelo Gov.br?"; pedido antigo como hoje.
- [ ] 4.4 `acompanhar/protocol-trilho.tsx`: "Formulário assinado" concluído para o eletrônico.
  "Falta só a sua assinatura." só quando falta a declaração (gratuidade) ou no pedido antigo.

## 5. Painel

- [ ] 5.1 Rota da via eletrônica: gerar o requerimento com `signature` pela sessão
  (`requests.manage`), registrando `service-request.print.requerimento-assinado` com
  `source: "electronic"`.
- [ ] 5.2 `pedidos/[protocolo]/page.tsx`: o cabeçalho usa `requerimentoSignedState`. Anexado
  abre o anexo, eletrônico abre a rota da 5.1, e "Gerar sem assinatura" continua na rota
  `imprimir`. A declaração não muda.
- [ ] 5.3 Detalhe: "Assinado eletronicamente em <data e hora>" com o nome digitado; aviso
  quando nome, contato, telefone, CPF, finalidade ou descrição atuais diferem de
  `signature.content` (função pura no core, testada; `createdAt` fora da comparação).
- [ ] 5.4 Formulário de correção de um pedido assinado: aviso antes de salvar de que a via
  assinada não muda com a correção.
- [ ] 5.5 `admin-overview.ts`: o último contato do cidadão não conta a assinatura eletrônica
  (ela é o próprio instante da criação). Conferir que nada no overview passou a ler
  `hasSignedForm` de outro jeito.

## 6. Fechamento

- [ ] 6.1 Rodar os testes tocados (`signature`, `requerimento`, `acceptance`, `declaracao`,
  `service-request` em processo) e `biome check`.
- [ ] 6.2 Gerar no Homolog, pelo host do cartório, um pedido assinado sem gratuidade e outro
  com gratuidade. Conferir a tela de sucesso, o PDF com carimbo, a consulta, o acompanhamento
  e o detalhe no painel, incluindo uma correção depois da assinatura.
- [ ] 6.3 Levar à serventia as Open Questions 1 a 3 do design. Se a resposta da 1 trouxer
  fundamento, atualizar o carimbo e o teste da 2.2.
