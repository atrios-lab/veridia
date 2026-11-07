## 1. Catálogo

- [x] 1.1 Renomear a opção `inteiro-teor` de `ri-certidao-matricula` para "Certidão de inteiro teor digital", sem mudar o id, e ajustar o nome do ato
- [x] 1.2 Criar `ri-certidao-inteiro-teor-papel`: `presential`, `identificationOnly`, prazo de 5 dias com a nota do art. 19, § 10, III, `guidance` e `processingHint` sobre a retirada no balcão
- [x] 1.3 Criar `rcpn-certidao-inteiro-teor`: opções nascimento, casamento, óbito e outra, `online`, sem `identificationOnly`, prazo de 5 dias, base legal do CNN e lista de documentos com o mandato "se o pedido for por advogado ou procurador"
- [x] 1.4 Marcar no ato e na opção de óbito quando o bloco de qualificação vale, com uma função pura do núcleo
- [x] 1.5 Adicionar as constantes da observação e do texto de assinatura do ato
- [x] 1.6 Atualizar `catalog.test.ts`: lista de opções, atos que pedem finalidade, atos "só identificação" fora do on-line, função do óbito, e nenhum texto do ato novo do RCPN citando o e-Notariado

## 2. Validação e dados

- [x] 2.1 Adicionar `requesterQualification` a `serviceRequestDetailsSchema`, opcional, com um leitor como `readActVariant`
- [x] 2.2 Em `src/core/request/form.ts`, exigir quem pede, finalidade e se o registrado é falecido quando o bloco vale; exigir o nome do representado em `attorney`; recusar o bloco fora desse ato ou no óbito
- [x] 2.3 Testar a regra em `node --test`: cada papel, óbito, outra certidão, ato sem o bloco, e envio em `attorney` sem anexo aceito
- [x] 2.4 Gravar a qualificação em `details` no site e no balcão, com a regra de gravação em função `...With(db, ...)` coberta em teste contra PGlite

## 3. Site

- [x] 3.1 Dar prioridade a `processingHint` em `ProcessingHint`, sem mudar o texto dos atos atuais
- [x] 3.2 Mostrar no formulário as perguntas do bloco, a observação e o lembrete do mandato em `attorney`, e escondê-los no óbito
- [x] 3.3 Usar o texto de assinatura do ato na tela de sucesso e nas telas de consulta (`protocol-lookup.tsx`, `protocol-trilho.tsx`), que hoje repetem o aviso geral
- [x] 3.4 Atualizar `/privacidade` com os dados novos
- [x] 3.5 Conferir em `marinho.localhost`: listas de imóveis e RCPN e formulário em cada papel, sem gravar pedido em produção

## 4. Balcão, painel e PDF

- [x] 4.1 Mostrar as mesmas perguntas e a observação no pedido do balcão (`manual-entry-form.tsx`)
- [x] 4.2 Mostrar as respostas no detalhe do pedido, inclusive na impressão do balcão
- [x] 4.3 Em `buildRequerimento`, adicionar as linhas novas e o texto de assinatura do ato, com teste
- [x] 4.4 Liberar a edição da finalidade no detalhe para o ato novo e testar `purposeFor`

## 5. Antes do deploy

- [x] 5.1 Conferir os arts. 114 a 119 do CNN no site do CNJ
- [x] 5.2 Ler o Provimento 004/2025-CGJ/RN e confirmar o prazo e o nome do papel
- [ ] 5.3 Confirmar com a serventia a entrega da certidão digital, o pagamento do papel e o selo do verbum ad verbum (entrega pelo site e verbum ad verbum no balcão ou on-line confirmados em 07/11/2026; falta o pagamento do papel)
- [ ] 5.4 Avisar as demais serventias dos atos novos
