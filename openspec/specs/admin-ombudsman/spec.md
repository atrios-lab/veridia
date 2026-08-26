# admin-ombudsman Specification

## Purpose
A fila e o detalhe da manifestação de ouvidoria no painel: o que a serventia vê, responde, anota e
tramita depois que o cidadão registra. O lado público — formulário, registro OUV, chave e consulta
— vive em ombudsman-channel.

## Requirements

### Requirement: Acesso à ouvidoria exige a permissão `channels.manage`

A fila `/admin/ouvidoria`, o detalhe da manifestação e toda ação sobre ela SHALL exigir sessão com
a permissão `channels.manage`. Cada Server Action SHALL refazer a checagem no servidor: esconder o
item do menu e devolver 404 na rota são cortesia, não controle de acesso.

#### Scenario: Sessão sem a permissão

- **WHEN** um usuário autenticado sem `channels.manage` abre `/admin/ouvidoria` ou o detalhe de
  uma manifestação
- **THEN** a rota responde como inexistente

#### Scenario: Ação chamada direto

- **WHEN** uma Server Action da ouvidoria é chamada por uma sessão sem `channels.manage`
- **THEN** nada é gravado e a ação devolve erro de permissão

### Requirement: Detalhe reúne a manifestação, o tratamento e o histórico

O detalhe SHALL mostrar o número do registro, o andamento atual, o tipo de manifestação, a data, a
marca de identificação (Identificada, Identidade em sigilo ou Anônima) e a mensagem do cidadão.
Nome e contato SHALL aparecer apenas quando existirem no registro.

O detalhe SHALL mostrar o histórico do tratamento com autor, ação e data, nomeando cada ação em
português. Uma ação sem rótulo conhecido MUST NOT exibir a chave crua do evento.

#### Scenario: Manifestação identificada

- **WHEN** o operador abre uma manifestação com nome e contato
- **THEN** vê o tipo, a data, "Identificada", a mensagem, o nome e o contato para resposta

#### Scenario: Manifestação anônima

- **WHEN** o operador abre uma manifestação sem nome e sem contato
- **THEN** vê "Anônima" e nenhum campo de nome ou contato, e o detalhe explica que não há a quem
  responder

### Requirement: Responder é a saída de quem tem contato

Quando a manifestação tem nome ou contato e ainda não foi respondida, o detalhe SHALL oferecer a
resposta ao cidadão, com rascunho salvável antes do envio. Enviada a resposta, o registro SHALL
passar ao andamento **Respondida** e o rascunho SHALL ser descartado — manter uma segunda cópia do
mesmo texto é manter uma cópia velha.

Manifestação já respondida SHALL exibir a resposta enviada, não o formulário.

#### Scenario: Rascunho antes do envio

- **WHEN** o operador salva o rascunho da resposta
- **THEN** o texto fica guardado no registro, nada é enviado ao cidadão e o andamento não muda

#### Scenario: Resposta enviada

- **WHEN** o operador envia a resposta de uma manifestação identificada
- **THEN** o andamento passa a "Respondida", a resposta fica visível no detalhe e o rascunho
  deixa de existir

### Requirement: Anotação interna é a saída de quem não tem contato

Quando a manifestação não tem nome nem contato, o detalhe SHALL oferecer anotação interna no lugar
da resposta, e SHALL dizer por que: não há a quem responder. A anotação interna MUST NOT ser
enviada a lugar algum e MUST NOT aparecer na consulta do cidadão.

#### Scenario: Anotação numa anônima

- **WHEN** o operador salva uma anotação interna
- **THEN** o texto fica no registro, o evento entra no histórico e nada sai da serventia

### Requirement: Mudar o andamento a partir do detalhe

O detalhe SHALL oferecer a mudança de andamento para **toda** manifestação, identificada ou
anônima, respondida ou não. Os andamentos do canal são cinco: `new` (Recebida), `in-review` (Em
apuração), `answered` (Respondida), `done` (Concluída) e `archived` (Arquivada).

O bloco SHALL destacar os próximos passos sugeridos para o andamento atual e SHALL permitir
escolher qualquer um dos cinco como correção. Isto é orientação de tela, não máquina de estados: o
servidor SHALL aceitar qualquer destino que seja um dos cinco andamentos do canal e SHALL recusar
apenas o andamento em que o registro já está, porque gravaria um evento sem informação.

**Respondida** MUST NOT ser alcançável por este bloco: responder é enviar um texto ao cidadão, e
marcar o andamento sem enviar nada deixaria o registro mentindo. O bloco alcança os outros quatro.

Toda mudança SHALL gravar auditoria e SHALL aparecer no histórico do registro nomeando o
andamento de destino.

#### Scenario: Anônima é concluída

- **WHEN** o operador de uma manifestação anônima em "Recebida" escolhe "Concluída"
- **THEN** o andamento muda, o evento entra no histórico e no log de auditoria, e a manifestação
  sai da contagem de abertas

#### Scenario: Denúncia sem o que apurar

- **WHEN** o operador escolhe "Arquivada"
- **THEN** o andamento muda para Arquivada, que é terminal como Concluída e diz outra coisa

#### Scenario: Marcar que está apurando

- **WHEN** o operador escolhe "Em apuração" numa manifestação recebida
- **THEN** o andamento muda e a manifestação continua contando como aberta

#### Scenario: Correção de andamento

- **WHEN** o operador de uma manifestação arquivada por engano escolhe "Em apuração"
- **THEN** a mudança é aceita: voltar atrás é caso de uso, não exceção

#### Scenario: Destino igual ao atual

- **WHEN** a ação recebe o andamento em que o registro já está
- **THEN** nada é gravado e a ação devolve erro

#### Scenario: Destino que não é do canal

- **WHEN** a ação recebe um andamento do pedido de serviço, como `pre-noted`
- **THEN** nada é gravado e a ação devolve erro, apesar de a coluna `status` ser compartilhada
  pelos quatro canais

#### Scenario: Responder não é um andamento a escolher

- **WHEN** o operador olha os andamentos oferecidos pelo bloco de tramitação
- **THEN** "Respondida" não está entre eles, e a resposta continua sendo o envio do texto

### Requirement: Contador de manifestações em aberto

O badge da ouvidoria na navegação e o contador da Visão geral SHALL contar as manifestações que
não estão num andamento terminal. Os andamentos terminais do canal são `answered`, `done` e
`archived`.

#### Scenario: Anônima deixa de pesar

- **WHEN** uma manifestação anônima recebe o andamento "Concluída" ou "Arquivada"
- **THEN** o contador de manifestações em aberto diminui na mesma navegação
