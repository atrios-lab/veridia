## ADDED Requirements

### Requirement: Pedido de nova senha pelo próprio usuário

O sistema SHALL oferecer, a partir de `/admin/login`, uma tela sem autenticação onde a pessoa
informa o seu e-mail e pede um link de nova senha. O link emitido SHALL ser o mesmo primitivo do
convite (validade de 48 horas, invalidando o token anterior da conta).

A tela SHALL responder sempre a mesma mensagem neutra, sem revelar se existe conta para o
e-mail informado. O link SHALL ser enviado apenas quando existir, na serventia do domínio
atual, uma conta ativa com aquele e-mail; conta desativada e conta de outra serventia MUST NOT
receber e-mail, e MUST receber a mesma resposta neutra.

O pedido SHALL respeitar o limite de tentativas por endereço já aplicado ao login. O envio
bem-sucedido SHALL ser registrado na auditoria com verbo próprio, distinto do pedido feito por
um registrador na tela de Usuários; um pedido para e-mail sem conta MUST NOT gerar registro de
auditoria.

#### Scenario: Caminho a partir do login

- **WHEN** uma pessoa sem sessão abre `/admin/login`
- **THEN** a tela oferece o caminho para pedir uma nova senha por conta própria

#### Scenario: Conta ativa recebe o link

- **WHEN** a pessoa informa o e-mail de uma conta ativa da serventia do domínio
- **THEN** chega a essa conta o e-mail de nova senha, com link válido por 48 horas, e a tela
  mostra a mensagem neutra

#### Scenario: E-mail sem conta

- **WHEN** a pessoa informa um e-mail que não tem conta em serventia nenhuma
- **THEN** nenhum e-mail é enviado, nada é gravado na auditoria, e a tela mostra exatamente a
  mesma mensagem neutra do caso anterior

#### Scenario: Conta desativada

- **WHEN** a pessoa informa o e-mail de uma conta desativada
- **THEN** nenhum e-mail é enviado e a tela mostra a mesma mensagem neutra

#### Scenario: Conta de outra serventia

- **WHEN** a pessoa informa, no domínio de uma serventia, o e-mail de uma conta de outra
- **THEN** nenhum e-mail é enviado e a tela mostra a mesma mensagem neutra

#### Scenario: Limite de tentativas

- **WHEN** o mesmo endereço estoura o limite de pedidos por minuto
- **THEN** a tela mostra o aviso de muitas tentativas, e não a mensagem neutra

#### Scenario: Link recebido leva à tela de definir senha

- **WHEN** a pessoa abre o link recebido dentro de 48 horas e envia a nova senha confirmada
- **THEN** a senha é gravada e a pessoa entra no painel, pelo mesmo caminho do convite

## MODIFIED Requirements

### Requirement: Convite de primeiro acesso vencido
O sistema SHALL recusar um link de convite com mais de 48 horas, mostrando que o link venceu
e por onde obter acesso, sem formulário de criação de senha. A tela SHALL oferecer o caminho de
pedir uma nova senha por conta própria, além de indicar quem responde pela serventia.

#### Scenario: Abrir link vencido
- **WHEN** a pessoa abre um link de convite emitido há mais de 48 horas
- **THEN** o sistema mostra que o convite venceu, sem exibir campos de senha, e oferece o
  caminho para pedir um novo link por conta própria
