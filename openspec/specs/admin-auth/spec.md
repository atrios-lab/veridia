# admin-auth

## Purpose

TBD

## Requirements

### Requirement: Tela de login com identidade da serventia

O sistema SHALL exibir, em `/admin/login`, um painel institucional com o selo, o nome e o
subtítulo da serventia resolvida pelo domínio, ao lado do formulário de e-mail e senha. A
aparência do painel (cores, tipografia) SHALL herdar o tema de marca publicado pela serventia —
o mesmo `data-theme` que o site público dela usa — em vez de uma estética fixa da plataforma.

#### Scenario: Visita não autenticada a /admin/login

- **WHEN** uma pessoa sem sessão válida acessa `/admin/login`
- **THEN** o sistema mostra o selo, nome e subtítulo da serventia do domínio atual, e o
  formulário de e-mail e senha, sem nenhum aviso de erro ou de sessão

#### Scenario: Duas serventias, temas diferentes

- **WHEN** `/admin/login` é aberto em domínios de duas serventias com temas de marca diferentes
- **THEN** as cores e a tipografia do painel de login variam conforme o tema publicado de cada
  uma; o selo, o nome e o subtítulo já variavam antes

### Requirement: Erro genérico de credencial inválida
O sistema SHALL responder com uma única mensagem genérica de erro para senha incorreta, e-mail
sem conta e conta de uma serventia diferente da do domínio acessado, sem indicar qual desses
motivos ocorreu.

#### Scenario: Senha incorreta
- **WHEN** o formulário é enviado com um e-mail existente e senha errada
- **THEN** o sistema mostra "E-mail ou senha inválidos." e não indica que o e-mail existe

#### Scenario: Conta de outra serventia
- **WHEN** o formulário é enviado com credenciais válidas de um usuário de outra serventia
- **THEN** o sistema encerra qualquer sessão criada, mostra a mesma mensagem "E-mail ou senha
  inválidos." e não menciona a serventia a que a conta pertence

### Requirement: Aviso de limite de tentativas
Quando o limite de tentativas de login é atingido, o sistema SHALL mostrar um aviso visualmente
distinto do erro de credencial (tom de alerta, não de erro) e SHALL desabilitar o botão de
envio enquanto o limite estiver ativo.

#### Scenario: Limite atingido
- **WHEN** o número de tentativas de login do endereço de origem excede o limite configurado
- **THEN** o sistema mostra "Muitas tentativas. Aguarde um instante e tente de novo." em tom de
  alerta (não de erro) e o botão de envio aparece desabilitado com o texto "Aguarde…"

### Requirement: Retorno ao destino após sessão expirada
O sistema SHALL redirecionar para `/admin/login` preservando o caminho originalmente pedido, e
SHALL mostrar um aviso "sua sessão terminou" nomeando o destino somente quando havia uma sessão
anterior (ainda que expirada, revogada, ou de outra serventia) — nunca numa primeira visita sem
sessão nenhuma.

#### Scenario: Sessão expira durante navegação em rota protegida
- **WHEN** uma pessoa com sessão expirada ou revogada acessa uma rota protegida do painel
- **THEN** o sistema redireciona para `/admin/login` com o caminho da rota preservado e mostra
  "Sua sessão terminou. Entre de novo para voltar a `<destino>`."

#### Scenario: Primeira visita sem sessão a uma rota protegida
- **WHEN** uma pessoa sem nenhuma sessão anterior acessa diretamente uma rota protegida do
  painel
- **THEN** o sistema redireciona para `/admin/login` sem mostrar o aviso de sessão terminada

#### Scenario: Login bem-sucedido após expiração volta ao destino
- **WHEN** a pessoa entra com sucesso a partir do login que preservou o caminho original
- **THEN** o sistema a leva para o caminho originalmente pedido, não para a página inicial do
  painel

### Requirement: Aviso de saída
Após sair do painel deliberadamente, o sistema SHALL mostrar um aviso confirmando a saída na
tela de login, distinto dos avisos de erro e de sessão expirada.

#### Scenario: Clicar em Sair
- **WHEN** uma pessoa autenticada aciona a saída do painel
- **THEN** o sistema encerra a sessão e mostra `/admin/login` com o aviso "Você saiu do
  painel.", sem nenhum aviso de erro ou de sessão expirada junto

### Requirement: Convite de primeiro acesso válido
O sistema SHALL permitir que uma pessoa com um link de convite não expirado (validade de 48
horas) crie sua própria senha e entre no painel em seguida, sem precisar digitar o e-mail
novamente.

#### Scenario: Criar senha a partir de link válido
- **WHEN** a pessoa abre o link de convite dentro de 48 horas da emissão e envia a nova senha
  (confirmada) no formulário
- **THEN** o sistema grava a nova senha para a conta identificada pelo link e a pessoa entra no
  painel

### Requirement: Convite de primeiro acesso vencido
O sistema SHALL recusar um link de convite com mais de 48 horas, mostrando que o link venceu
e por onde obter acesso, sem formulário de criação de senha. A tela SHALL oferecer o caminho de
pedir uma nova senha por conta própria, além de indicar quem responde pela serventia.

#### Scenario: Abrir link vencido
- **WHEN** a pessoa abre um link de convite emitido há mais de 48 horas
- **THEN** o sistema mostra que o convite venceu, sem exibir campos de senha, e oferece o
  caminho para pedir um novo link por conta própria

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
