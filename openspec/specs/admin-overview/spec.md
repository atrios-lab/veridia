# admin-overview

## Purpose

Tela inicial do painel administrativo (`/admin`): agrega os canais do cidadão (pedidos de
serviço, requerimentos LGPD, ouvidoria, agenda) para o operador saber o que há para fazer, com
links para cada fila. Sincronizado do change `add-admin-channel-queues`.
## Requirements
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

### Requirement: Mesa vazia é resultado bom, não ausência de dados

Quando nenhum item aguardar o cartório, a mesa SHALL dizer que nada espera pela serventia, em
vez de sugerir que não há trabalho em aberto, e SHALL manter o caminho para a fila de pedidos.

#### Scenario: Nada aguarda o cartório, mas há pedidos em aberto

- **WHEN** todos os itens em aberto já foram respondidos e aguardam o cidadão
- **THEN** a mesa diz que nada aguarda o cartório no momento, e oferece o link para a fila de
  pedidos, sem afirmar que não há itens em aberto

### Requirement: Card da trilha de primeiros passos

A tela `/admin` SHALL mostrar, na coluna de cards ao lado de "Atalhos de teclado", o card
"Primeiros passos" com o andamento da pessoa na trilha de vídeos de treinamento ("N de M assistidos") e
o link para o próximo vídeo não assistido. O card SHALL ser omitido quando a trilha está
completa ou quando o catálogo não tem vídeo de trilha. O andamento SHALL ser o da pessoa da
sessão, não o da serventia.

#### Scenario: Pessoa no meio da trilha
- **WHEN** a trilha tem sete vídeos e a pessoa assistiu a três
- **THEN** o card mostra "3 de 7 assistidos" e "Próximo: <título>" levando a
  `/admin/ajuda?video=<id do próximo>`

#### Scenario: Trilha completa some
- **WHEN** a pessoa assistiu a todos os vídeos da trilha
- **THEN** o card não aparece, e os demais cards da coluna continuam no lugar

#### Scenario: Andamento é por pessoa
- **WHEN** duas pessoas da mesma serventia abrem `/admin`, uma com dois vídeos assistidos e
  outra com nenhum
- **THEN** cada uma vê o próprio andamento

### Requirement: Mesa de trabalho ordenada por urgência com próximo passo

A tela `/admin` SHALL exibir o bloco "Sua mesa hoje": os itens em aberto dos canais que a sessão
pode operar (pedidos de serviço, requerimentos LGPD, ouvidoria, agenda), numa lista única
ordenada por urgência, limitada aos itens mais urgentes. A ordem de urgência SHALL ser: (1)
requerimentos LGPD vencidos ou a 3 dias ou menos do prazo legal, (2) pedidos de serviço com
exigência cumprida aguardando retomada, (3) pedidos de horário para o dia corrente ainda não
confirmados, (4) demais itens, mais antigo primeiro.

Cada item SHALL mostrar um chip de urgência em português (ex.: "vence em 3d", "para hoje",
"novo"), o protocolo, o interessado (ou "manifestação anônima"), um resumo e o próximo passo
como botão-link para o detalhe do item na fila correspondente — sem executar a ação a partir da
Visão geral.

#### Scenario: Requerimento LGPD perto do prazo encabeça a mesa

- **WHEN** existem um requerimento LGPD a 3 dias do prazo legal, um pedido de serviço novo e uma
  manifestação nova
- **THEN** o requerimento LGPD aparece primeiro, com chip de vencimento em destaque e o botão
  "Responder agora" levando a `/admin/lgpd/[protocolo]`

#### Scenario: Exigência cumprida vem antes de itens novos

- **WHEN** um pedido de serviço em análise teve a exigência cumprida pelo cidadão e outro pedido
  acabou de entrar
- **THEN** o pedido com exigência cumprida aparece antes, com o botão "Retomar análise" levando
  ao detalhe do pedido

#### Scenario: Mesa vazia tem estado explícito

- **WHEN** não há nenhum item em aberto nos canais que a sessão pode operar
- **THEN** o bloco mostra uma mensagem de mesa vazia em português, em vez de sumir ou ficar em
  branco

#### Scenario: Canal sem permissão fica fora da mesa

- **WHEN** a sessão não tem a permissão `channels.manage`
- **THEN** a mesa não inclui itens de LGPD, ouvidoria nem agenda

### Requirement: Atalhos de ação apenas para funcionalidades existentes

A tela `/admin` SHALL exibir uma linha de atalhos de ação com, no mínimo: "Novo pedido no
balcão" (para `/admin/pedidos/novo`, com a dica da tecla N), "Confirmar horário" (para
`/admin/agenda`, com a quantidade de pedidos de horário aguardando confirmação) e "Nova
publicação" (para `/admin/publicacoes`). Um atalho cuja rota exija permissão que a sessão não
tem SHALL ser omitido. Atalhos previstos no design para funcionalidades inexistentes (modelos de
exigência, bloquear agenda) NÃO SHALL ser renderizados enquanto elas não existirem.

#### Scenario: Atalho leva à criação de pedido no balcão

- **WHEN** o operador aciona o atalho "Novo pedido no balcão"
- **THEN** é levado a `/admin/pedidos/novo`

#### Scenario: Contagem de horários pendentes no atalho

- **WHEN** existem 2 pedidos de horário com situação "Pedido enviado"
- **THEN** o atalho "Confirmar horário" indica 2 pendentes

### Requirement: Agenda de hoje com destaque para o próximo compromisso

A tela `/admin` SHALL listar os pedidos de horário do dia corrente (no fuso da serventia) em
ordem de horário, com o nome do interessado e o assunto. O próximo compromisso confirmado ainda
não ocorrido SHALL aparecer destacado; compromissos já atendidos SHALL aparecer como concluídos
e pedidos ainda não confirmados como aguardando confirmação. O bloco SHALL linkar para
`/admin/agenda` e mostrar um estado vazio explícito quando não houver compromissos no dia.

#### Scenario: Próximo compromisso destacado

- **WHEN** há um horário confirmado às 11h ainda não ocorrido e outro às 9h30 já atendido
- **THEN** o de 11h aparece destacado como próximo e o de 9h30 como concluído

#### Scenario: Dia sem compromissos

- **WHEN** não há pedidos de horário para o dia corrente
- **THEN** o bloco informa que não há compromissos hoje

### Requirement: Cidadão aguardando no chat visível na Visão geral

A tela `/admin` SHALL mostrar o card "Acontecendo agora" quando o atendimento online está
habilitado e a sessão tem a permissão `chat.manage`: a conversa aguardando há mais tempo, com
nome do cidadão, assunto e tempo de espera, e a ação "Assumir conversa" levando a
`/admin/atendimento`. O card SHALL se atualizar por polling enquanto a aba está visível e NÃO
SHALL ser renderizado quando não há ninguém aguardando ou o chat está desabilitado.

#### Scenario: Conversa aguardando aparece com tempo de espera

- **WHEN** um cidadão entra na fila do chat e espera 4 minutos
- **THEN** o card mostra o nome informado, o assunto e a espera, e "Assumir conversa" leva a
  `/admin/atendimento`

#### Scenario: Sem fila, sem card

- **WHEN** nenhuma conversa está aguardando
- **THEN** o card "Acontecendo agora" não é renderizado

### Requirement: Continuar de onde parou

A tela `/admin` SHALL mostrar o card "Continuar de onde parou" com o último item em que o
próprio usuário da sessão agiu (registrado na auditoria) e que ainda está em aberto: protocolo,
descrição resumida e um botão levando ao detalhe. Sem item aplicável, o card NÃO SHALL ser
renderizado. O card SHALL refletir o usuário da sessão, nunca a atividade de colegas.

#### Scenario: Retoma o último item do próprio usuário

- **WHEN** a operadora respondeu ontem a um pedido que continua em análise e outra pessoa agiu
  em outros itens depois
- **THEN** o card dela mostra aquele pedido, e "Continuar" leva ao detalhe dele

#### Scenario: Item concluído não volta para a mesa

- **WHEN** o último item em que o usuário agiu já foi concluído ou entregue
- **THEN** o card mostra o item aberto mais recente anterior a ele, ou não é renderizado se não
  houver

### Requirement: Cabeçalho da Visão geral com resumo e acesso à busca

O cabeçalho da tela `/admin` SHALL manter a saudação pelo primeiro nome conforme a hora no fuso
da serventia e a data por extenso, e SHALL acrescentar um resumo da mesa (quantidade de itens e
de prazos críticos) e um gatilho visível da busca global exibindo a dica "Ctrl K". A tela SHALL
ainda exibir um cartão listando os atalhos de teclado disponíveis.

#### Scenario: Resumo da mesa no cabeçalho

- **WHEN** a mesa tem 5 itens, sendo 1 requerimento LGPD perto do prazo
- **THEN** o cabeçalho resume "5 itens na sua mesa" e "1 prazo crítico"

#### Scenario: Gatilho abre a busca global

- **WHEN** o operador clica no campo de busca do cabeçalho
- **THEN** o overlay da busca global abre com o foco no campo de texto

### Requirement: Situação dos canais em lista compacta

A tela `/admin` SHALL mostrar o bloco "Situação dos canais": uma linha por canal que a sessão
pode operar, com a quantidade de itens em aberto e um link para a fila correspondente. A linha
de um canal com item urgente (requerimento LGPD perto do prazo ou vencido) SHALL aparecer em
destaque. Um canal cuja permissão a sessão não tem SHALL ser omitido, sem quebrar o layout dos
demais.

#### Scenario: Linha leva à fila do canal

- **WHEN** o operador clica na linha "manifestações na Ouvidoria"
- **THEN** é levado a `/admin/ouvidoria`

#### Scenario: Canal com prazo crítico em destaque

- **WHEN** existe um requerimento LGPD a 3 dias do prazo legal
- **THEN** a linha de Requerimentos LGPD aparece destacada como prazo crítico

#### Scenario: Sessão sem permissão não vê a linha do canal

- **WHEN** uma sessão não tem a permissão `channels.manage`
- **THEN** as linhas de LGPD, Ouvidoria e Agenda de atendimentos não aparecem

