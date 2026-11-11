## ADDED Requirements

### Requirement: Acesso ao painel em duas etapas

Depois da senha, o painel SHALL exigir um código de 6 dígitos enviado ao e-mail da conta, válido por 10
minutos, antes de liberar qualquer tela, ação ou rota. A confirmação SHALL valer até o fim da sessão, e
códigos errados repetidos SHALL bloquear novas tentativas por um tempo.

#### Scenario: Senha certa, sem código

- **WHEN** a pessoa acerta a senha e tenta abrir uma tela do painel sem informar o código
- **THEN** o painel leva à tela do código e não mostra a tela pedida

#### Scenario: Código certo

- **WHEN** a pessoa informa o código recebido por e-mail
- **THEN** o painel abre a tela que ela pediu

#### Scenario: Primeiro acesso

- **WHEN** a pessoa cria a senha pelo link do convite
- **THEN** o painel abre sem pedir código, e o código passa a ser pedido no acesso seguinte

#### Scenario: Dispositivo salvo

- **WHEN** a pessoa marca "Salvar este dispositivo" ao informar o código e depois entra de novo nele
- **THEN** o painel abre sem pedir código, até o administrador pedir o código de novo para essa pessoa

#### Scenario: E-mail de verificação escolhido pelo administrador

- **WHEN** o administrador define outro e-mail de verificação para uma pessoa
- **THEN** o código dessa pessoa passa a ir para esse e-mail, e só para ele

#### Scenario: Conta da Átrios

- **WHEN** a conta mestre da Átrios entra com a senha
- **THEN** o painel abre sem pedir código

#### Scenario: A pessoa troca o próprio e-mail de verificação

- **WHEN** a pessoa informa um novo e-mail de verificação em Minha conta e confirma o código enviado a ele
- **THEN** os próximos códigos dela vão para esse e-mail, e ela não consegue alterar o e-mail de outra pessoa
