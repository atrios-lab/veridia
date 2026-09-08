## MODIFIED Requirements

### Requirement: Mesa de trabalho com urgências na frente e rotina do mais novo para o mais antigo

A "Sua mesa hoje" da tela `/admin` SHALL listar apenas os itens em aberto cuja vez é do
cartório, nesta ordem: primeiro os requerimentos LGPD perto do prazo legal ou vencidos, depois
os pedidos de serviço com exigência cumprida aguardando retomada, e por fim os demais itens do
mais novo para o mais antigo. A lista SHALL mostrar no máximo 6 itens.

A vez SHALL ser do cartório quando a última ação do cidadão sobre o registro for mais recente
que a última ação da serventia, ou quando a serventia ainda não tiver agido sobre ele.

São ações do cidadão a criação do registro, cada mensagem que ele escreve na conversa de uma
exigência e cada arquivo que ele anexa ao pedido pela consulta de protocolo, seja comprovante de
pagamento ("Já paguei") ou documento extra. A criação SHALL contar como ação do cidadão mesmo
quando o registro for lançado no balcão por um operador. Anexos feitos pela serventia NÃO SHALL
contar como ação do cidadão.

São ações da serventia apenas as que devolvem o registro ao cidadão: mudar o andamento,
registrar, corrigir, responder ou dar por cumprida uma exigência, e responder a requerimento
LGPD ou manifestação de ouvidoria. Escrituração de balcão, como informar o valor ou reemitir a
chave de acesso, e trabalho não enviado, como rascunho de resposta e anotação interna, NÃO
SHALL contar como ação da serventia. Uma ação da serventia ainda não classificada NÃO SHALL
tirar o item da mesa. A mudança de andamento feita pelo próprio cidadão ao informar o pagamento
NÃO SHALL contar como ação da serventia.

Um pedido de serviço em "Pagamento informado" SHALL aparecer na mesa com resumo que diga que há
comprovante a conferir e ação "Conferir pagamento", na mesma posição de rotina dos demais.

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

#### Scenario: Comprovante enviado devolve o pedido à mesa

- **WHEN** um operador põe o pedido em "Aguardando pagamento" e depois o cidadão envia o
  comprovante pelo "Já paguei" na consulta de protocolo
- **THEN** o pedido volta a aparecer na mesa, com o resumo de comprovante a conferir e a ação
  "Conferir pagamento"

#### Scenario: Reenvio de comprovante também devolve o pedido à mesa

- **WHEN** um pedido em "Pagamento informado" foi tocado por um operador sem mudar de andamento
  e o cidadão reenvia o comprovante
- **THEN** o pedido volta a aparecer na mesa

#### Scenario: Documento extra devolve o pedido à mesa

- **WHEN** um pedido que havia saído da mesa recebe um documento extra anexado pelo cidadão na
  consulta de protocolo
- **THEN** o pedido volta a aparecer na mesa

#### Scenario: Anexo do cartório não devolve o pedido à mesa

- **WHEN** um operador anexa um arquivo a um pedido que já havia saído da mesa
- **THEN** o pedido continua fora da mesa

#### Scenario: Rascunho de resposta não tira o item da mesa

- **WHEN** um operador salva um rascunho de resposta a uma manifestação de ouvidoria sem enviar
- **THEN** a manifestação continua na mesa

#### Scenario: Valor informado no balcão não tira o pedido da mesa

- **WHEN** um operador informa o valor de um pedido que ainda não recebeu nenhuma resposta
- **THEN** o pedido aparece na mesa, porque informar valor é escrituração e não resposta ao
  cidadão

#### Scenario: Pedido lançado no balcão entra na mesa

- **WHEN** um operador lança um pedido manualmente no balcão
- **THEN** o pedido aparece na mesa, como um pedido recebido pelo site apareceria

#### Scenario: Prazo legal permanece na mesa mesmo depois de tocado

- **WHEN** um requerimento LGPD a 2 dias do prazo legal foi respondido parcialmente pelo
  operador, sem ser concluído
- **THEN** o requerimento continua na mesa, na frente dos demais itens

#### Scenario: Pedido que chegou ontem aparece na mesa mesmo com itens antigos aguardando

- **WHEN** há 10 pedidos de rotina aguardando o cartório e o mais novo chegou ontem
- **THEN** o pedido novo aparece na mesa, acima dos itens de rotina mais antigos

#### Scenario: Ordem entre urgências e rotina

- **WHEN** a mesa tem um requerimento LGPD vencido, um pedido com exigência cumprida e um pedido
  novo
- **THEN** a mesa lista o requerimento LGPD primeiro, o pedido com exigência cumprida em
  seguida e o pedido novo por último
