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

### A busca é consulta: `Act.consultation`

O responsável pelo produto definiu, em 07/11/2026, que a busca não é um pedido comum. A marca `consultation` no ato decide tudo de uma vez:

- **CPF opcional**, no site e no balcão. Quem não tem CPF também pergunta. Um CPF informado ainda é conferido.
- **Sem requerimento assinado.** Sem CPF não há Gov.br, e a busca não pratica ato. A tela de sucesso troca os passos de assinar e enviar por "Aguarde a resposta", e a consulta do protocolo não cobra o requerimento. É a exceção à regra de que todo pedido do site termina pedindo o requerimento assinado.
- **Sem valor nem entrega.** O painel esconde os dois cartões, e o servidor recusa valor num pedido de busca.

### A resposta conclui o pedido

O cartão "Resposta da busca" pede se o registro foi localizado e o texto ao cidadão. A resposta fica em `details.searchAnswer` (`found`, `text`, `answeredAt`, `answeredBy`), e o mesmo update leva o pedido a "Concluído". Corrigir a resposta grava de novo e avisa de novo.

O e-mail diz só que a busca foi respondida. O conteúdo fala de dados do registro e fica atrás da chave de acesso, como o motivo do indeferimento.

As pílulas de próximo andamento somem na busca, porque sugerem pagamento. O seletor de correção do andamento continua, para cancelar ou arquivar.

### O cidadão pede a certidão num pedido novo

A consulta do protocolo mostra a resposta. Se o registro foi localizado, dois botões levam ao pedido de certidão comum e ao de inteiro teor. A busca não vira pedido de certidão: no inteiro teor, quem pede informa o motivo, e muitas vezes é um advogado.

`/acompanhar` ganha um trilho próprio da busca, sem os passos de assinar, pagar e receber documento. `/protocolo` mostra o mesmo cartão e um andamento de três passos.

## Risks / Trade-offs

- **Custo da busca** → a tabela de emolumentos pode cobrar a busca. O site não mostra preço, e a serventia lança o valor como nos demais atos.
- **Resposta com dado do registro** → a serventia decide o que informa. A orientação diz "quando puder".
- **Busca sem requerimento** → a serventia responde sem papel assinado. Quem quer o ato faz o pedido comum, que exige o requerimento.
