## Why

O inteiro teor de imóveis tem duas formas de entrega, com valores diferentes: digital e em papel de segurança, retirada no balcão. O site só oferece uma opção, e o selo promete "Termina on-line" para as duas. No RCPN, o inteiro teor (verbum ad verbum) nem existe como pedido comum, embora seja procurado sobretudo por advogados, por exemplo para comprovar aposentadoria rural, e o Código Nacional de Normas (CNN) peça dados próprios para esse requerimento.

## What Changes

- **Imóveis, digital:** a opção `inteiro-teor` de `ri-certidao-matricula` passa a se chamar "Certidão de inteiro teor digital".
- **Imóveis, papel:** novo ato "Certidão de inteiro teor em papel de segurança", com o selo "Termina no balcão" e prazo próprio.
- **RCPN:** novo ato "Certidão de inteiro teor (verbum ad verbum)", com escolha entre nascimento, casamento, óbito ou outra.
- Nesse ato, salvo no óbito, o formulário pede quem está pedindo (próprio interessado, advogado ou procurador, ou outra pessoa), a finalidade, o grau de parentesco, se houver, e se o registrado é falecido. Por procuração, pede também o nome do representado.
- O formulário mostra uma observação sobre os casos em que a serventia pode exigir autorização judicial e orienta quem pede por procuração a anexar o mandato.
- Qualquer pessoa consegue enviar o pedido. A serventia analisa depois do recebimento e recusa ou abre exigência se faltar o mandato ou outro documento.
- O requerimento desse ato orienta a assinatura por Gov.br, ICP-Brasil ou firma reconhecida, sem citar o e-Notariado.
- O requerimento em PDF e o detalhe do pedido no painel mostram as respostas novas.
- A política de privacidade passa a citar esses dados.

## Non-goals

- **Preço no site:** nenhuma das certidões mostra valor. O operador continua informando o valor no painel.
- **Papel ou digital em outras certidões:** a escolha vale só para o inteiro teor de imóveis.
- **Trava do mandato no envio:** o site não exige o anexo nem verifica se o arquivo é um mandato. Essa análise é do operador.
- **Autorização judicial no site:** o site avisa, mas não decide quando ela é necessária.
- **Testamento:** a regra do art. 547 do Provimento 156/2016-CGJ/RN é de Notas e fica fora desta mudança.
- **Gratuidade:** a marcação "Inteiro teor" na entrada da gratuidade não ganha estas perguntas nesta mudança.
- **Requerimento no óbito:** o site continua pedindo o requerimento assinado em todo pedido, como hoje, apesar do art. 118 do CNN.
- **Correção no painel:** as respostas novas não são editáveis no detalhe nesta versão; a finalidade segue editável como hoje.
- **Ato por serventia:** o catálogo continua igual para todas as serventias com a atribuição.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `service-request`: catálogo com os dois atos novos, exceção à regra de não pedir finalidade em certidão, perguntas do inteiro teor do RCPN e orientação de assinatura.
- `admin-service-requests`: o detalhe do pedido mostra as respostas do inteiro teor do RCPN.

## Impact

- `src/core/acts/catalog.ts` e testes: atos, opções, regra do óbito e textos.
- `src/core/request/form.ts`, `src/core/request/kinds.ts`: validação e gravação em `details`, sem migração.
- `src/core/request/requerimento.ts`: linhas novas e aviso de assinatura por ato.
- `src/app/(public)/solicitar/`: formulário, selo e tela de sucesso.
- `src/app/admin/(dashboard)/pedidos/`: balcão e detalhe do pedido.
- `src/app/(public)/privacidade/page.tsx`: dados coletados.
