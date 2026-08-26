## ADDED Requirements

### Requirement: Atualizar nome e papel de uma conta

O sistema SHALL oferecer, para cada conta do painel da serventia da sessão, a ação "Atualizar",
que permite alterar o nome e o papel ("Registrador" ou "Operador") daquela conta. O e-mail SHALL
ser exibido apenas como identificação da conta, sem ser editável. A ação SHALL exigir a permissão
`user.manage`, SHALL recusar qualquer conta que não pertença à serventia da sessão, e SHALL
recusar qualquer papel fora do conjunto oferecido no painel. O papel alterado SHALL valer a
partir da requisição seguinte, sem exigir novo login.

#### Scenario: Registrador corrige o nome de uma conta
- **WHEN** o registrador aciona "Atualizar" em uma conta, informa um nome diferente e salva
- **THEN** o sistema grava o novo nome, a lista passa a exibi-lo e todo lugar do painel que
  nomeia essa pessoa, inclusive em registros anteriores à alteração, passa a exibir o nome novo

#### Scenario: Registrador promove um operador
- **WHEN** o registrador aciona "Atualizar" em uma conta de Operador, escolhe o papel
  "Registrador" e salva
- **THEN** o sistema grava o novo papel e a pessoa passa a ter as permissões de Registrador já
  na próxima requisição que fizer, sem precisar sair e entrar de novo

#### Scenario: Nome em branco
- **WHEN** o registrador salva a atualização com o nome vazio ou só com espaços
- **THEN** o sistema recusa a alteração e mostra o erro junto ao campo, mantendo o que já havia
  sido digitado

#### Scenario: Conta de outra serventia
- **WHEN** chega uma submissão de atualização apontando para uma conta que não pertence à
  serventia da sessão
- **THEN** o sistema recusa a operação sem alterar nada

#### Scenario: Papel não oferecido no painel
- **WHEN** chega uma submissão de atualização com um papel fora dos papéis oferecidos no painel
- **THEN** o sistema recusa a alteração e nada é gravado

### Requirement: Proteção — não é possível rebaixar a última conta Registrador ativa

O sistema SHALL recusar, no servidor, a alteração de papel que deixaria a serventia sem nenhuma
conta com papel Registrador e acesso ativo. A recusa SHALL valer inclusive quando a conta-alvo é
a da própria sessão.

#### Scenario: Único registrador tenta virar operador
- **WHEN** o registrador aciona "Atualizar" na própria conta, escolhe o papel "Operador" e salva,
  e não há outra conta Registrador com acesso ativo na serventia
- **THEN** o sistema recusa a alteração, informa que é preciso manter ao menos um Registrador com
  acesso ativo, e nem o nome nem o papel são gravados

#### Scenario: Rebaixamento permitido quando há outro registrador ativo
- **WHEN** o registrador rebaixa para "Operador" uma conta Registrador e existe pelo menos outra
  conta Registrador com acesso ativo na serventia
- **THEN** o sistema grava o novo papel

### Requirement: Copiar link de nova senha

O sistema SHALL oferecer, para qualquer conta da serventia da sessão, a alternativa de obter o
link em vez de enviá-lo por e-mail — tanto o link de nova senha quanto o do convite, que são o
mesmo link emitido pelo mesmo mecanismo. O link SHALL ser emitido pelo mesmo mecanismo do envio
por e-mail — mesma validade de 48 horas e mesma invalidação do link anterior daquela conta — e
SHALL ficar disponível para o registrador copiar e entregar por outro meio. A ação SHALL exigir a
permissão `user.manage` e SHALL ser registrada na auditoria com um verbo próprio, distinto do
envio por e-mail.

#### Scenario: E-mail não é aceito pelo provedor e o registrador entrega o link
- **WHEN** o envio do link de nova senha ou do convite falha e o registrador aciona a alternativa
  de copiar o link
- **THEN** o sistema emite um link válido por 48 horas, disponibiliza-o para cópia, e a pessoa
  consegue criar a própria senha abrindo esse link

#### Scenario: Copiar invalida o link anterior
- **WHEN** o registrador obtém o link de nova senha de uma conta que já tinha um link em aberto
- **THEN** apenas o link mais recente funciona, e o anterior deixa de ser aceito

### Requirement: Falha de envio de e-mail nas ações de conta

Quando o envio do convite ou do link de nova senha não for aceito pelo provedor, o sistema SHALL
manter a operação sem efeito visível para o destinatário, SHALL informar ao registrador que o
envio não foi aceito e apontar a alternativa de copiar o link, e SHALL registrar no log do
servidor o erro retornado pelo provedor, identificando qual ação falhou. A resposta do provedor
NÃO SHALL ser exibida na tela.

#### Scenario: Provedor recusa o destinatário
- **WHEN** o registrador aciona "Nova senha" e o provedor de e-mail recusa o envio
- **THEN** a tela informa que o envio não foi aceito e oferece copiar o link, sem prometer que
  uma nova tentativa resolverá, e o motivo retornado pelo provedor fica registrado no log do
  servidor

#### Scenario: Falha ao reenviar convite
- **WHEN** o registrador aciona "Reenviar convite" e o provedor de e-mail recusa o envio
- **THEN** a tela informa que o envio não foi aceito e o motivo retornado pelo provedor fica
  registrado no log do servidor
