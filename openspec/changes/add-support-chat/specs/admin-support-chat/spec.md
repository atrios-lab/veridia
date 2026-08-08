## ADDED Requirements

### Requirement: Interruptor "Disponível para o chat" some o botão na hora

A tela de Atendimento online SHALL oferecer um interruptor "Disponível para o chat", restrito à
permissão `chat.settings`. Desligá-lo SHALL remover o botão flutuante do site público na próxima
sondagem do widget (poucos segundos), sem esperar por deploy. Conversas já em andamento SHALL
continuar até serem encerradas — desligar o interruptor MUST NOT encerrá-las nem escondê-las do
painel.

#### Scenario: Desligar em horário de atendimento
- **WHEN** um usuário com `chat.settings` desliga "Disponível para o chat"
- **THEN** o botão flutuante deixa de aparecer no site em poucos segundos
- **AND** conversas com status `active` continuam visíveis e respondíveis no painel

#### Scenario: Sem a permissão
- **WHEN** um usuário sem `chat.settings` tenta desligar o interruptor
- **THEN** o servidor recusa a ação, independente do que a interface mostrar

### Requirement: Fila operacional com urgência visível

A tela SHALL listar as conversas em espera com assunto, protocolo informado (quando houver) e
tempo de espera, colorido conforme a urgência (livre, atenção, crítico). Cada linha SHALL oferecer
"Atender", que atribui a conversa ao atendente que aciona.

#### Scenario: Atender assume a conversa
- **WHEN** um atendente disponível aciona "Atender" numa conversa em espera
- **THEN** a conversa passa a `active`, atribuída a ele, e sai da fila de espera de todos os
  outros atendentes

#### Scenario: Cor por tempo de espera
- **WHEN** uma conversa espera além do limiar de atenção configurado
- **THEN** sua linha na fila muda de cor para indicar a urgência maior

### Requirement: Status pessoal e limite de 3 conversas simultâneas

Cada atendente SHALL controlar seu próprio status (Disponível, Ocupado, Ausente). O servidor SHALL
recusar "Atender" quando o atendente já tem 3 conversas `active` atribuídas a ele, com uma
mensagem explicando o limite.

#### Scenario: Quarta conversa recusada
- **WHEN** um atendente com 3 conversas `active` aciona "Atender" numa quarta
- **THEN** o servidor recusa a atribuição e a conversa permanece na fila

#### Scenario: Status Ausente não impede atender manualmente
- **WHEN** um atendente com status "Ausente" aciona "Atender" em uma conversa da fila
- **THEN** a atribuição é aceita normalmente — o status é informativo para os colegas, não uma
  trava de ação

### Requirement: Contexto da conversa aponta para o pedido vinculado

A conversa SHALL mostrar de qual página do site o cidadão veio e, quando um protocolo foi
localizado no pré-chat, um atalho para abrir o pedido completo.

#### Scenario: Atalho para o pedido
- **WHEN** a conversa tem um pedido localizado no pré-chat
- **THEN** a conversa mostra um link "Abrir {protocolo}" que leva ao detalhe do pedido no painel

### Requirement: Respostas prontas agilizam a resposta

A conversa SHALL oferecer um conjunto fixo de respostas prontas (saudação, pedir documento,
horário de funcionamento, encerramento) que o atendente pode inserir no campo de mensagem com um
clique, antes de enviar.

#### Scenario: Inserir resposta pronta
- **WHEN** o atendente escolhe a resposta pronta "Horário de funcionamento"
- **THEN** o texto correspondente é inserido no campo de mensagem, editável antes do envio

### Requirement: Nota interna nunca sai para o cidadão

O atendente SHALL poder registrar uma nota interna na conversa, exibida com destaque visual
distinto das mensagens. A nota SHALL ser visível a qualquer atendente com acesso à conversa e
MUST NOT ser enviada nem exibida no widget do cidadão.

#### Scenario: Nota registrada
- **WHEN** o atendente registra uma nota interna
- **THEN** ela aparece na conversa com o autor e a hora, distinta visualmente das mensagens
  trocadas com o cidadão

### Requirement: Transferência exige nota interna e mostra carga dos colegas

Transferir SHALL oferecer a lista de colegas da mesma serventia com status e número de conversas
atuais, mais a opção "Devolver à fila geral". Toda transferência SHALL exigir uma nota interna
explicando o motivo antes de ser concluída. Quem recebe a conversa SHALL ver todo o histórico,
incluindo notas internas anteriores.

#### Scenario: Transferência sem nota é recusada
- **WHEN** o atendente tenta transferir sem preencher a nota interna
- **THEN** o servidor recusa a transferência e a conversa continua com o atendente atual

#### Scenario: Histórico completo para quem recebe
- **WHEN** uma conversa é transferida para outro atendente
- **THEN** o atendente que recebe vê todas as mensagens e notas internas anteriores, não apenas as
  daí em diante

#### Scenario: Devolver à fila geral
- **WHEN** o atendente escolhe "Devolver à fila geral" em vez de um colega específico
- **THEN** a conversa volta a `waiting`, sem atendente atribuído, disponível para qualquer um
  assumir

### Requirement: Encerrar vincula, lança pedido novo ou só encerra

Ao encerrar, o atendente SHALL escolher entre: vincular a transcrição a um protocolo existente
(pré-preenchido quando há um pedido localizado ou informado), lançar um pedido novo a partir da
conversa (mesmo formulário do lançamento manual em `/admin/pedidos/novo`, com a origem registrada
como "a partir de uma conversa"), ou só encerrar sem vincular. A transcrição SHALL ficar retida
por 6 meses independentemente da escolha.

#### Scenario: Vincular a um protocolo existente
- **WHEN** o atendente encerra e escolhe vincular ao protocolo localizado
- **THEN** a conversa grava `linked_request_id` e o pedido passa a listar essa transcrição no seu
  histórico

#### Scenario: Lançar pedido a partir da conversa
- **WHEN** o atendente escolhe "Lançar um pedido novo a partir desta conversa" ao encerrar
- **THEN** o formulário de lançamento manual abre pré-preenchido com nome e contato do cidadão, e
  o pedido criado fica vinculado à conversa que o originou

### Requirement: Contador de conversas aguardando na sidebar

A sidebar do painel SHALL mostrar, em qualquer tela, o número de conversas em espera na
serventia, atrás da permissão `chat.manage`.

#### Scenario: Contador visível fora da tela de atendimento
- **WHEN** há 2 conversas aguardando e o usuário está em `/admin/pedidos`
- **THEN** o item "Atendimento online" da sidebar mostra o número 2
