## ADDED Requirements

### Requirement: Registro do retorno de uma mensagem

O sistema SHALL oferecer um endpoint que recebe do provedor de e-mail o aviso de que uma mensagem
voltou, e SHALL registrar o endereço, o tipo do retorno, a descrição informada pelo provedor e
quando aconteceu. O registro SHALL ser indexado pelo endereço, de modo que a mesma consulta sirva
a qualquer lugar do sistema onde aquele endereço apareça.

#### Scenario: Mensagem para caixa inexistente volta
- **WHEN** o provedor avisa que uma mensagem para um endereço voltou porque a caixa não existe
- **THEN** o sistema registra aquele endereço, com o tipo do retorno e o que o provedor informou

#### Scenario: Segundo retorno para o mesmo endereço
- **WHEN** chega um aviso para um endereço que já tem retorno registrado
- **THEN** o registro daquele endereço passa a refletir o retorno mais recente, sem duplicar o
  endereço

#### Scenario: Aviso malformado
- **WHEN** chega no endpoint um corpo que não tem a forma esperada
- **THEN** o sistema recusa o aviso e nada é gravado

### Requirement: Autenticação do endpoint de retorno

O endpoint SHALL aceitar apenas avisos que apresentem o segredo configurado para ele, comparado
de forma que não vaze o segredo pelo tempo da resposta. Quando o segredo não estiver configurado
no ambiente, o endpoint SHALL recusar todo aviso.

#### Scenario: Aviso sem o segredo
- **WHEN** chega um aviso sem o segredo, ou com um segredo diferente do configurado
- **THEN** o sistema recusa a requisição e nada é gravado

#### Scenario: Ambiente sem o segredo configurado
- **WHEN** o segredo não está configurado e chega um aviso, mesmo bem formado
- **THEN** o sistema recusa a requisição, em vez de aceitar por não ter com o que comparar

### Requirement: Envio recusado para endereço que não recebe

O sistema SHALL recusar o envio de qualquer mensagem para um endereço com retorno permanente
registrado, antes de acionar o provedor. A recusa SHALL informar a quem tentou qual endereço não
recebe e o que o provedor respondeu quando a mensagem voltou, e SHALL ser distinguível de uma
falha do provedor.

#### Scenario: Atendente responde uma exigência para um endereço que voltou
- **WHEN** alguém no painel dispara uma mensagem para um endereço com retorno permanente
  registrado
- **THEN** o sistema não aciona o provedor, e a tela informa que aquele endereço não recebe,
  com o motivo do retorno

#### Scenario: A tentativa não conta contra a conta de envio
- **WHEN** um envio é recusado por esta regra
- **THEN** nenhuma requisição é feita ao provedor

#### Scenario: Endereço sem retorno registrado
- **WHEN** alguém dispara uma mensagem para um endereço sem retorno registrado
- **THEN** o envio segue normalmente

### Requirement: Retorno temporário não impede o envio

O sistema SHALL registrar todo tipo de retorno, mas SHALL bloquear envios apenas para os que
significam que o endereço não existe ou foi bloqueado em definitivo. Retorno temporário — caixa
cheia, resposta automática de ausência, recusa momentânea — NÃO SHALL impedir o envio seguinte.

#### Scenario: Caixa cheia
- **WHEN** uma mensagem volta porque a caixa do destinatário está cheia, e depois alguém envia
  outra mensagem para aquele endereço
- **THEN** o retorno fica registrado, e o envio seguinte é feito normalmente
