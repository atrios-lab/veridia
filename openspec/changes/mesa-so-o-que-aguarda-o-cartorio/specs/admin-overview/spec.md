## MODIFIED Requirements

### Requirement: Mesa de trabalho com urgências na frente e rotina do mais novo para o mais antigo

A "Sua mesa hoje" da tela `/admin` SHALL listar apenas os itens em aberto cuja vez é do
cartório, nesta ordem: primeiro os requerimentos LGPD perto do prazo legal ou vencidos, depois
os pedidos de serviço com exigência cumprida aguardando retomada, e por fim os demais itens do
mais novo para o mais antigo. A lista SHALL mostrar no máximo 6 itens.

A vez SHALL ser do cartório quando a última ação do cidadão sobre o registro for mais recente
que a última ação da serventia, ou quando a serventia ainda não tiver agido sobre ele.

São ações do cidadão a criação do registro e cada mensagem que ele escreve na conversa de uma
exigência. A criação SHALL contar como ação do cidadão mesmo quando o registro for lançado no
balcão por um operador.

São ações da serventia apenas as que devolvem o registro ao cidadão: mudar o andamento,
registrar, corrigir, responder ou dar por cumprida uma exigência, e responder a requerimento
LGPD ou manifestação de ouvidoria. Escrituração de balcão, como informar o valor ou reemitir a
chave de acesso, e trabalho não enviado, como rascunho de resposta e anotação interna, NÃO
SHALL contar como ação da serventia. Uma ação da serventia ainda não classificada NÃO SHALL
tirar o item da mesa.

Um requerimento LGPD perto do prazo legal ou vencido SHALL permanecer na mesa enquanto não for
concluído, mesmo depois de o cartório ter agido sobre ele.

Um item que sai da mesa SHALL continuar acessível em "Situação dos canais" e na fila de
`/admin/pedidos`.

#### Scenario: Pedido respondido pelo cartório sai da mesa

- **WHEN** um pedido de serviço em aberto teve seu andamento alterado por um operador e o
  cidadão não agiu desde então
- **THEN** o pedido não aparece na mesa, e continua em aberto na fila de `/admin/pedidos`

#### Scenario: Pedido volta à mesa quando o cidadão responde

- **WHEN** um pedido que havia saído da mesa recebe uma mensagem do cidadão na conversa de uma
  exigência, com ou sem anexo
- **THEN** o pedido volta a aparecer na mesa, sem nenhuma marcação manual do operador

#### Scenario: Rascunho de resposta não tira o item da mesa

- **WHEN** um operador salva um rascunho de resposta a uma manifestação de ouvidoria e não a
  responde
- **THEN** a manifestação continua na mesa

#### Scenario: Valor informado no balcão não tira o pedido da mesa

- **WHEN** um operador cadastra um pedido no balcão e informa o valor no mesmo lançamento
- **THEN** o pedido aparece na mesa, porque informar valor é escrituração e não resposta ao
  cidadão

#### Scenario: Pedido lançado no balcão entra na mesa

- **WHEN** um operador cadastra manualmente um pedido de serviço pelo painel
- **THEN** o pedido aparece na mesa, como um pedido recebido pelo site apareceria

#### Scenario: Prazo legal permanece na mesa mesmo depois de tocado

- **WHEN** um requerimento LGPD a 1 dia do prazo teve um rascunho ou uma ação registrada por um
  operador, e continua em aberto
- **THEN** o requerimento continua na mesa, na frente dos demais itens

#### Scenario: Pedido que chegou ontem aparece na mesa mesmo com itens antigos aguardando

- **WHEN** há 6 ou mais pedidos de serviço aguardando o cartório com semanas de espera e um
  pedido novo chega
- **THEN** o pedido novo aparece na mesa, acima dos itens de rotina mais antigos

#### Scenario: Urgências continuam na frente dos itens novos

- **WHEN** há um requerimento LGPD a 1 dia do prazo, um pedido com exigência cumprida e um
  pedido recém-chegado, todos aguardando o cartório
- **THEN** a mesa lista o requerimento LGPD primeiro, o pedido com exigência cumprida em
  seguida e o pedido recém-chegado depois deles

### Requirement: Aviso de itens fora do corte da mesa

Quando houver mais itens aguardando o cartório do que a mesa mostra, a mesa SHALL indicar
quantos itens ficaram de fora, com um link para a fila de pedidos. A contagem SHALL considerar
apenas os itens que aguardam o cartório, nunca os que aguardam o cidadão.

#### Scenario: Corte de 6 com 10 itens aguardando o cartório

- **WHEN** há 10 itens aguardando o cartório e a mesa mostra 6
- **THEN** a mesa indica que há mais 4 itens, com link para `/admin/pedidos`

#### Scenario: Itens que aguardam o cidadão não entram na contagem

- **WHEN** há 6 itens aguardando o cartório e 20 itens em aberto aguardando o cidadão
- **THEN** nenhum aviso de itens fora do corte aparece

#### Scenario: Tudo cabe na mesa

- **WHEN** há 6 ou menos itens aguardando o cartório
- **THEN** nenhum aviso de itens fora do corte aparece

## ADDED Requirements

### Requirement: Mesa vazia é resultado bom, não ausência de dados

Quando nenhum item aguardar o cartório, a mesa SHALL dizer que nada espera pela serventia, em
vez de sugerir que não há trabalho em aberto, e SHALL manter o caminho para a fila de pedidos.

#### Scenario: Nada aguarda o cartório, mas há pedidos em aberto

- **WHEN** todos os itens em aberto já foram respondidos e aguardam o cidadão
- **THEN** a mesa diz que nada aguarda o cartório no momento, e oferece o link para a fila de
  pedidos, sem afirmar que não há itens em aberto
