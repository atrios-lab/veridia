## Context

A busca de imóveis (`ri-busca-indicador`) já existe e resulta numa certidão. No RCPN, a consulta pedida é outra: saber se o registro está na serventia e o que ele diz, antes de escolher a certidão. O responsável pelo produto descreveu o fluxo em 07/11/2026: a consulta não é em banco de dados, e, se der positivo, a resposta orienta a refazer o pedido no ato certo.

## Decisions

### Um ato próprio, com descrição obrigatória

A busca entra como ato do RCPN, com as mesmas opções de registro da certidão. A descrição é obrigatória, porque sem nome, filiação e o que se quer saber não há o que procurar. O exemplo do campo traz a pergunta da profissão, o caso que motivou o ato.

Alternativa: uma opção "busca" dentro da certidão. Descartada: a busca não é certidão, e o selo e a orientação seriam os da certidão.

### O motivo é pedido

O que se pergunta sobre o registro pode ser dado que só sai no inteiro teor, como a profissão. O motivo é pedido como no inteiro teor, pela mesma decisão de 07/11/2026.

### Sem prazo legal

A Lei 6.015, art. 19, fixa prazo para certidões. A busca não é certidão, então o ato não tem `legalDeadlineDays`, e vale o prazo padrão da serventia.

### A resposta segue pelo protocolo

O operador responde pelos canais do pedido que já existem. O site não converte a busca em pedido de certidão: quem pede abre outro pedido no ato indicado.

## Risks / Trade-offs

- **Custo da busca** → a tabela de emolumentos pode cobrar a busca. O site não mostra preço, e a serventia lança o valor como nos demais atos.
- **Resposta com dado do registro** → a serventia decide o que informa. A orientação diz "quando puder".
