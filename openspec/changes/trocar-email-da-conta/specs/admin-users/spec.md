## ADDED Requirements

### Requirement: Pedido de troca do e-mail da conta

O sistema SHALL permitir que quem tem a permissão `user.manage` peça a troca do e-mail de uma
conta da serventia da sessão, informando o endereço pretendido no diálogo "Atualizar conta". O
pedido NÃO SHALL alterar o e-mail da conta: até a confirmação, a conta SHALL continuar entrando
com o endereço antigo e recebendo nele os links de recuperação. O sistema SHALL enviar ao
endereço pretendido um link de confirmação válido por 48 horas, e SHALL registrar o pedido na
auditoria.

#### Scenario: Registrador pede a troca
- **WHEN** o registrador informa um endereço diferente no campo E-mail e salva
- **THEN** o sistema envia o link de confirmação ao endereço novo, informa que a troca só vale
  depois da confirmação, e o e-mail da conta permanece o antigo

#### Scenario: Login antigo continua valendo durante a pendência
- **WHEN** existe uma troca de e-mail pendente e a pessoa entra no painel com o e-mail antigo e
  a senha dela
- **THEN** o acesso é concedido normalmente

#### Scenario: Endereço pretendido já pertence a outra conta
- **WHEN** o registrador pede a troca para um endereço que já é o e-mail de outra conta
- **THEN** o sistema recusa o pedido, mostra o erro junto ao campo E-mail, não envia e-mail
  nenhum e nada fica pendente

#### Scenario: Endereço inválido
- **WHEN** o registrador salva um valor que não é um e-mail válido
- **THEN** o sistema recusa o pedido e mostra o erro junto ao campo, preservando o que já havia
  sido digitado

#### Scenario: Mesmo endereço que a conta já tem
- **WHEN** o registrador salva sem alterar o endereço
- **THEN** nenhum pedido de troca é criado e nenhum e-mail é enviado, e as demais alterações do
  diálogo são gravadas normalmente

#### Scenario: Falha no envio da confirmação
- **WHEN** o provedor de e-mail não aceita o envio do link de confirmação
- **THEN** o sistema informa a falha no diálogo e não deixa troca pendente registrada

### Requirement: Confirmação da troca no endereço novo

O sistema SHALL oferecer uma página pública que consome o link de confirmação, sem exigir sessão.
Ao consumir um link válido, o sistema SHALL gravar o endereço novo como e-mail da conta, SHALL
invalidar o link e SHALL registrar a troca na auditoria. A partir daí o endereço novo SHALL ser
o login da conta, e o antigo SHALL deixar de servir. A senha da conta SHALL permanecer
inalterada e as sessões abertas SHALL continuar valendo.

#### Scenario: Confirmação bem-sucedida
- **WHEN** a pessoa abre o link recebido no endereço novo dentro de 48 horas
- **THEN** o sistema grava o endereço novo, confirma na tela que a troca foi concluída, e a conta
  passa a entrar com esse endereço

#### Scenario: E-mail antigo deixa de servir de login
- **WHEN** a troca foi confirmada e alguém tenta entrar com o endereço antigo
- **THEN** o acesso é recusado

#### Scenario: Link já usado ou expirado
- **WHEN** a pessoa abre um link de confirmação que já foi usado, que expirou, ou que foi
  substituído por um pedido mais recente
- **THEN** a tela informa que o link não vale mais e o e-mail da conta não muda

#### Scenario: Endereço foi ocupado entre o pedido e a confirmação
- **WHEN** a pessoa abre um link de confirmação válido, mas o endereço pretendido passou a
  pertencer a outra conta desde o pedido
- **THEN** o sistema recusa a troca, explica na tela que aquele endereço não está mais
  disponível, e o e-mail da conta permanece o antigo

#### Scenario: Conta deixou de existir
- **WHEN** a pessoa abre um link de confirmação de uma conta que foi excluída
- **THEN** a tela informa que o link não vale mais, sem erro de sistema

### Requirement: Um pedido de troca por conta

O sistema SHALL manter no máximo um pedido de troca de e-mail em aberto por conta. Um pedido novo
SHALL invalidar o anterior daquela conta.

#### Scenario: Segundo pedido substitui o primeiro
- **WHEN** o registrador pede a troca para um endereço e depois pede novamente para outro
- **THEN** somente o link mais recente confirma a troca, e o link anterior deixa de valer

### Requirement: Troca pendente visível na lista de contas

A lista de contas do painel SHALL indicar, na linha da conta, quando existe uma troca de e-mail
em aberto, nomeando o endereço pretendido.

#### Scenario: Lista mostra a pendência
- **WHEN** a lista de Usuários é aberta e uma conta tem troca de e-mail pendente
- **THEN** a linha dessa conta mostra o e-mail atual e a indicação da troca pendente, com o
  endereço pretendido

#### Scenario: Indicação some depois de confirmada
- **WHEN** a troca é confirmada e a lista é aberta de novo
- **THEN** a linha mostra o endereço novo como e-mail da conta, sem indicação de pendência

### Requirement: Aviso ao endereço antigo

Ao concluir uma troca de e-mail, o sistema SHALL avisar o endereço antigo de que o e-mail da
conta foi alterado. A falha nesse aviso NÃO SHALL desfazer nem bloquear a troca já confirmada, e
SHALL ficar registrada no log do servidor.

#### Scenario: Aviso enviado
- **WHEN** uma troca de e-mail é confirmada
- **THEN** o endereço antigo recebe um aviso de que o e-mail da conta foi alterado

#### Scenario: Aviso não é aceito pelo provedor
- **WHEN** uma troca é confirmada e o envio do aviso ao endereço antigo falha
- **THEN** a troca permanece válida, a tela confirma a conclusão, e a falha do envio fica
  registrada no log do servidor
