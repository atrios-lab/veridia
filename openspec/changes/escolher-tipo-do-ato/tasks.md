## 1. Catálogo

- [x] 1.1 Adicionar `variants` a `Act` e declarar os tipos dos seis atos em `src/core/acts/catalog.ts`, com `requiresDescription` em "Outra certidão"
- [x] 1.2 Implementar `actVariantName(act, variantId)`, devolvendo `undefined` para id ausente ou desconhecido
- [x] 1.3 Cobrir em `catalog.test.ts` a lista fixa de ids por ato, a ausência de tipos em RCPJ constituição e RI retificação, e o helper

## 2. Validação e gravação

- [x] 2.1 Adicionar `actVariant` a `serviceRequestDetailsSchema` e criar `readActVariant` em `src/core/request/kinds.ts`
- [x] 2.2 Adicionar `actVariant` a `commonFields` e às regras de `actRules` em `src/core/request/form.ts`, resolvendo os tipos pelo ato pedido na gratuidade
- [x] 2.3 Cobrir em `request.test.ts` tipo ausente, tipo de outro ato, tipo em ato sem tipos, "Outra certidão" sem descrição e gratuidade com e sem tipos
- [x] 2.4 Confirmar em `acceptance.test.ts` que o hash do aceite não muda com o tipo
- [x] 2.5 Ler e gravar `actVariant` em `submitServiceRequest` e `createManualServiceRequest`, e devolver o nome específico como `actName` na tela de sucesso do site

## 3. Pedido duplicado

- [x] 3.1 Passar `actVariant` a `findOpenServiceRequestDuplicateWith`, filtrando por `details->>'actVariant'` no `WHERE`, e repassá-lo em `submitServiceRequest`
- [x] 3.2 Cobrir contra PGlite em `src/lib/service-request.test.ts` tipo diferente, mesmo tipo, pedido aberto sem tipo e ato sem tipos

## 4. Formulários

- [x] 4.1 Mostrar o select acima da descrição em `src/app/(public)/solicitar/request-form.tsx`, no padrão de `appointment-form.tsx`
- [x] 4.2 Mostrar o select dentro do bloco da gratuidade e limpar o valor com `setValue` ao trocar o ato pedido
- [x] 4.3 Mostrar o select em `pedidos/novo/manual-entry-form.tsx`, nos dois lugares, descartando o valor ao trocar o ato

## 5. Leitores do nome específico

- [x] 5.1 Usar o nome do tipo no cabeçalho do andamento, no campo "Ato" e no selo da gratuidade em `pedidos/[protocolo]/page.tsx`
- [x] 5.2 Usar o nome do tipo na linha da fila em `pedidos/page.tsx`
- [x] 5.3 Usar o nome do tipo em `src/app/(public)/protocolo/actions.ts`
- [x] 5.4 Passar `actVariant` a `buildRequerimento` por `src/lib/request-documents.ts` e usar o nome em "Ato requerido" e na linha da gratuidade
- [x] 5.5 Cobrir em `requerimento.test.ts` pedido com tipo, gratuidade com tipo, pedido antigo e tipo retirado do catálogo

## 6. Correção pelo operador

- [x] 6.1 Criar `resolveVariantEdit` em `src/core/request/edit.ts` e cobri-la em teste: vazio, válido, inválido e gratuidade
- [x] 6.2 Extrair `updateRequestDataWith(db, ...)` em `src/lib/service-request.ts` e fazer o merge de `actVariant` em `details`, sem apagar o valor quando vier vazio
- [x] 6.3 Validar o tipo em `updateRequestDataAction` e devolver erro quando for inválido
- [x] 6.4 Mostrar o select abaixo do campo "Ato" em `applicant-section.tsx`, só quando houver opções
- [x] 6.5 Cobrir contra PGlite a correção do tipo, a preservação de `phone` e demais chaves de `details`, e o registro no histórico

## 7. Verificação

- [x] 7.1 Rodar os testes tocados pela change
- [x] 7.2 No navegador, pelo host do cartório, pedir certidão de nascimento e depois de casamento com o mesmo e-mail e confirmar que os dois protocolos são criados
- [x] 7.3 Conferir no painel o tipo no detalhe, na fila e no requerimento, corrigir o tipo e confirmar o registro no histórico
- [x] 7.4 Conferir o select em largura de celular, no site (375 px) e no balcão (500 px, a menor largura da janela do Chrome)
