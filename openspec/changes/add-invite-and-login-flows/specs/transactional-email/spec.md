## ADDED Requirements

### Requirement: E-mail de convite de primeiro acesso

Ao criar uma conta ou reenviar um convite, o sistema SHALL enviar um e-mail transacional ao
endereço da conta, na identidade visual da serventia (selo, nome e subtítulo do tenant),
dizendo quem convidou, o papel da pessoa convidada e contendo um único botão de ação para criar
a senha. O e-mail NÃO SHALL conter nenhuma senha.

#### Scenario: Convite enviado após criação de conta
- **WHEN** uma conta é criada com sucesso
- **THEN** o sistema envia ao e-mail informado uma mensagem com o selo e o nome da serventia da
  sessão, o papel da conta criada, e um único botão "Criar minha senha" apontando para o link de
  primeiro acesso

### Requirement: E-mail de nova senha

Ao acionar "Nova senha" para uma conta ativa, o sistema SHALL enviar um e-mail transacional ao
endereço da conta avisando que uma nova senha foi pedida, com um botão de ação para criá-la e um
aviso de que a senha atual continua válida e de que, se a pessoa não pediu a troca, deve avisar
a serventia.

#### Scenario: Nova senha enviada
- **WHEN** o registrador aciona "Nova senha" para uma conta ativa
- **THEN** o sistema envia ao e-mail da conta uma mensagem com o botão "Criar nova senha" e o
  aviso "se não foi você quem pediu, avise a serventia"

### Requirement: Identidade da serventia no e-mail

O sistema SHALL montar o corpo dos e-mails de convite e de nova senha a partir dos dados do
tenant resolvido no momento do envio (selo, nome, subtítulo), nunca de um texto fixo de uma
serventia específica.

#### Scenario: Duas serventias, e-mails com identidades diferentes
- **WHEN** contas de duas serventias diferentes recebem e-mail de convite
- **THEN** cada e-mail mostra o selo, o nome e o subtítulo da própria serventia, sem nenhum
  texto ou logotipo fixo de outra

### Requirement: Envio sem provedor configurado cai para log

Em um ambiente sem a credencial do provedor de e-mail configurada, o sistema SHALL registrar o
conteúdo do e-mail (destinatário, assunto, link de ação) em log local em vez de falhar a ação
que o disparou.

#### Scenario: Ambiente de desenvolvimento sem credencial de e-mail
- **WHEN** uma conta é criada em um ambiente sem a variável de provedor de e-mail configurada
- **THEN** a conta é criada normalmente, o sistema registra o conteúdo do convite em log local, e
  nenhum erro é mostrado ao registrador
