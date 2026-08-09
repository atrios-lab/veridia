## ADDED Requirements

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

## REMOVED Requirements

### Requirement: Contadores por canal levando à fila correspondente

**Reason**: O design 7a v2 substitui os cartões grandes de contadores pela lista compacta
"Situação dos canais", que preserva contagens, links e gating por permissão num formato menor.
**Migration**: Coberto pelo requirement "Situação dos canais em lista compacta" (ADDED abaixo).

### Requirement: Atividade recente dos quatro canais em ordem cronológica

**Reason**: A lista passiva de eventos sai da Visão geral; a mesa de trabalho e o card
"Continuar de onde parou" cobrem o acompanhamento acionável. O histórico por item permanece nos
detalhes de cada fila.
**Migration**: Sem substituto direto na Visão geral; a auditoria continua alimentando "Continuar
de onde parou".

### Requirement: Prazos a acompanhar em destaque

**Reason**: Os prazos (LGPD perto do vencimento, exigência cumprida aguardando retomada) deixam
de ser um bloco próprio e passam a ser as camadas mais urgentes da mesa de trabalho.
**Migration**: Coberto pelo requirement "Mesa de trabalho ordenada por urgência com próximo
passo" (camadas 1 e 2).
