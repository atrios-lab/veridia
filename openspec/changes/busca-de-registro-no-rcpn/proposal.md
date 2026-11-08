## Why

Antes de pedir a certidão, muita gente quer saber se o registro está na serventia e o que ele diz. Um caso comum: saber se o registro de nascimento de alguém é daquela serventia e se a profissão consta como agricultor, para decidir se vale pedir o inteiro teor para a aposentadoria rural. Hoje não há onde fazer essa consulta pelo site.

## What Changes

- Novo ato do RCPN, "Busca de registro (consulta antes da certidão)", com a escolha entre nascimento, casamento, óbito ou outro registro.
- O formulário pede a descrição do que procurar e do que se quer saber, com um exemplo de nome, filiação e profissão, e o motivo do pedido.
- A orientação diz que a busca não é a certidão: a serventia procura nos livros, responde pelo protocolo e, se o registro constar, quem pede faz um novo pedido no ato certo, certidão comum ou de inteiro teor.
- O selo é "Termina on-line" e "Só identificação", e o ato não tem prazo legal: vale o padrão da serventia.
- **Consulta, não ato:** a busca não pede CPF obrigatório nem requerimento assinado. A tela de sucesso e a consulta do protocolo não cobram o requerimento.
- **Painel:** no detalhe da busca, o valor e a entrega dão lugar ao cartão "Resposta da busca". O operador marca se o registro foi localizado e escreve a resposta, como "consta nesta serventia, profissão agricultor". Enviar a resposta conclui o pedido e avisa o cidadão por e-mail, sem o conteúdo.
- **Consulta do protocolo:** o cidadão lê a resposta e, se o registro foi localizado, tem os botões para pedir a certidão comum ou a de inteiro teor, num pedido novo.
- A política de privacidade cita a busca.

## Non-goals

- **Busca em banco de dados:** o site não consulta nenhum acervo. Quem procura é a serventia.
- **Conversão automática do pedido:** o pedido de busca não vira certidão. Quem pede abre outro pedido.
- **Preço:** o site não mostra o valor da busca.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `service-request`: ato de busca no RCPN, sem CPF obrigatório nem requerimento assinado, com a resposta na consulta do protocolo.
- `admin-service-requests`: resposta da busca no lugar do valor e da entrega.

## Impact

- `src/core/acts/catalog.ts` e testes: `Act.consultation`.
- `src/core/request/form.ts`, `src/core/request/kinds.ts`: CPF opcional e `details.searchAnswer`, sem migração.
- `src/lib/service-request.ts`: `answerSearchWith`, testada contra o PGlite.
- `src/app/admin/(dashboard)/pedidos/[protocolo]/`: cartão e ação da resposta; valor recusado no servidor.
- `src/app/(public)/protocolo/`, `src/app/(public)/acompanhar/`, `src/app/(public)/solicitar/`: resposta, sucesso sem requerimento e CPF opcional.
- `src/core/request/request.test.ts`.
- `src/app/(public)/privacidade/page.tsx`.
