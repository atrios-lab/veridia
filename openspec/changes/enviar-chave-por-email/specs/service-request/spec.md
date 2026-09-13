## ADDED Requirements

### Requirement: Recuperação da chave pelo cidadão
A consulta de protocolo DEVE (SHALL) oferecer "Perdi a chave de acesso": o cidadão informa o
protocolo do pedido e o e-mail; quando os dois conferem com o pedido, o sistema DEVE (SHALL)
gerar uma chave nova, invalidar a anterior e enviar a nova apenas para o e-mail de contato do
pedido, registrando a recuperação no histórico como ação do cidadão. A resposta na tela DEVE
(SHALL) ser a mesma quando o protocolo não existe, quando o e-mail não confere e quando o envio
foi feito, sem confirmar a existência do pedido nem o e-mail. O sistema NÃO DEVE (SHALL NOT)
trocar a chave quando o e-mail não confere nem quando o endereço tem devolução permanente
registrada. A ação DEVE (SHALL) ter rate limit por origem e por protocolo. Só protocolos de
pedido de serviço são aceitos; ninguém da serventia participa.

#### Scenario: Protocolo e e-mail conferem
- **WHEN** o cidadão informa o protocolo e o e-mail do pedido
- **THEN** chega ao e-mail uma mensagem "Nova chave de acesso" com o protocolo e a chave nova no
  corpo, a chave anterior deixa de abrir a consulta, e a tela diz que a chave foi enviada se os
  dados conferem

#### Scenario: E-mail não confere
- **WHEN** o cidadão informa um e-mail diferente do contato do pedido
- **THEN** a tela mostra a mesma mensagem, nenhum e-mail é enviado e a chave atual continua
  valendo

#### Scenario: Protocolo inexistente
- **WHEN** o cidadão informa um protocolo que não existe na serventia
- **THEN** a tela mostra a mesma mensagem, sem revelar que o protocolo não existe

#### Scenario: Endereço que não recebe
- **WHEN** o e-mail do pedido tem devolução permanente registrada
- **THEN** a chave atual não é trocada e a tela mostra a mesma mensagem

#### Scenario: Recuperação em série
- **WHEN** o mesmo protocolo recebe a quarta tentativa de recuperação dentro de uma hora
- **THEN** a tentativa é recusada por limite, sem trocar a chave

#### Scenario: Recuperação fica no histórico
- **WHEN** a recuperação é concluída
- **THEN** o histórico do pedido no painel registra que o cidadão recuperou a chave pelo site

## MODIFIED Requirements

### Requirement: Protocolo sequencial e chave de acesso exibida uma única vez
Ao gravar, o sistema DEVE (SHALL) gerar protocolo `REQ.AAAA.NNNNNN` (sequência por tenant e ano, sem
colisão sob concorrência) e uma chave de acesso `XXXX-XXXX-XXXX` (alfabeto sem caracteres
ambíguos). A chave DEVE (SHALL) ser armazenada apenas como hash; o texto claro aparece somente na
resposta da submissão (impresso no comprovante de acesso) e no e-mail de confirmação enviado ao
endereço do próprio cidadão. O pedido nasce com status `new`, escopado ao tenant, e a criação
DEVE (SHALL) ser auditada.

#### Scenario: Sucesso mostra protocolo e chave uma vez
- **WHEN** a submissão é aceita
- **THEN** a tela de sucesso mostra protocolo e chave com botões copiar e informa para qual
  e-mail a chave também foi enviada; recarregar a página não a mostra de novo

#### Scenario: Chave não recuperável do banco
- **WHEN** qualquer consulta lê o registro do pedido
- **THEN** apenas o hash da chave existe; o texto claro não está armazenado

### Requirement: E-mail de confirmação do protocolo
Todo pedido protocolado pelo site DEVE (SHALL) render uma confirmação por e-mail para o endereço
informado, trazendo o número do protocolo, a chave de acesso e a orientação de guardar a
mensagem e não compartilhar a chave. A chave NÃO SHALL constar do assunto nem de nenhum link
do e-mail: só do corpo. O envio SHALL ser fire-and-forget: falha de e-mail nunca falha o
protocolo, e a tela de sucesso continua sendo a primeira via da chave. Pedidos gravados antes
desta mudança, cujo contato não é um endereço de e-mail, NÃO SHALL gerar tentativa de envio.

#### Scenario: Confirmação enviada com a chave
- **WHEN** o pedido é criado com e-mail "maria@exemplo.com"
- **THEN** chega um e-mail "Pedido recebido" com o número do protocolo e a chave de acesso no
  corpo, e o assunto traz só o protocolo

#### Scenario: A chave não vai no link
- **WHEN** o cidadão clica em "Consultar o protocolo" no e-mail
- **THEN** a consulta abre sem protocolo nem chave na URL; ele os informa no formulário

#### Scenario: Falha de e-mail não derruba o protocolo
- **WHEN** o envio do e-mail falha
- **THEN** o pedido é protocolado normalmente e o cidadão vê protocolo e chave na tela

#### Scenario: Pedido antigo sem e-mail
- **WHEN** um aviso de andamento é disparado para um pedido antigo cujo contato é "(84) 99999-0000"
- **THEN** nenhum e-mail é tentado e o andamento é registrado normalmente
