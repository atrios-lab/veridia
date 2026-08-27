# admin-overview (delta)

## ADDED Requirements

### Requirement: Mesa de trabalho com urgências na frente e rotina do mais novo para o mais antigo

A "Sua mesa hoje" da tela `/admin` SHALL listar os itens em aberto nesta ordem: primeiro os
requerimentos LGPD perto do prazo legal ou vencidos, depois os pedidos de serviço com exigência
cumprida aguardando retomada, e por fim os demais itens em aberto do mais novo para o mais
antigo. A lista SHALL mostrar no máximo 6 itens.

#### Scenario: Pedido que chegou ontem aparece na mesa mesmo com itens antigos em aberto

- **WHEN** há 6 ou mais pedidos de serviço em aberto com semanas de espera e um pedido novo
  chega
- **THEN** o pedido novo aparece na mesa, acima dos itens de rotina mais antigos

#### Scenario: Urgências continuam na frente dos itens novos

- **WHEN** há um requerimento LGPD a 1 dia do prazo, um pedido com exigência cumprida e um
  pedido recém-chegado
- **THEN** a mesa lista o requerimento LGPD primeiro, o pedido com exigência cumprida em
  seguida e o pedido recém-chegado depois deles

### Requirement: Aviso de itens fora do corte da mesa

Quando houver mais itens em aberto do que a mesa mostra, a mesa SHALL indicar quantos itens
ficaram de fora, com um link para a fila de pedidos.

#### Scenario: Corte de 6 com 10 itens em aberto

- **WHEN** há 10 itens em aberto e a mesa mostra 6
- **THEN** a mesa indica que há mais 4 itens em aberto, com link para `/admin/pedidos`

#### Scenario: Tudo cabe na mesa

- **WHEN** há 6 ou menos itens em aberto
- **THEN** nenhum aviso de itens fora do corte aparece
