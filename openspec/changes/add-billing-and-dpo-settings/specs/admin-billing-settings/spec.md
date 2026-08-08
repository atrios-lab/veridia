## ADDED Requirements

### Requirement: Aba Cobrança com a chave Pix da serventia

A rota `/admin/configuracoes/cobranca` SHALL exigir sessão válida na serventia do host e a
permissão `content.edit` para ser aberta, checadas no servidor. A tela SHALL apresentar a faixa de
abas com Cobrança selecionada e um bloco "Chave Pix da serventia" com dois campos: o tipo da chave
e o valor da chave.

Os tipos aceitos SHALL ser CPF, CNPJ, e-mail, telefone e chave aleatória, e nenhum outro.

A tela SHALL declarar, em texto, que o sistema confere o formato da chave mas não tem como saber
se a conta é da serventia, e que o sistema não fica sabendo quando o Pix cai — a conferência do
recebimento continua sendo da serventia, pelo extrato.

#### Scenario: Aba abre com a chave em vigor

- **WHEN** um usuário com `content.edit` abre `/admin/configuracoes/cobranca` numa serventia com
  chave cadastrada
- **THEN** o tipo e o valor da chave em vigor aparecem preenchidos

#### Scenario: Serventia sem chave cadastrada

- **WHEN** a serventia nunca cadastrou chave
- **THEN** os campos aparecem vazios e a tela declara que, sem chave, a consulta de protocolo não
  exibe QR Code e o cidadão vê apenas o valor e a instrução de pagar no balcão

#### Scenario: Acesso sem permissão

- **WHEN** um usuário autenticado sem `content.edit` requisita `/admin/configuracoes/cobranca`
- **THEN** o servidor recusa o acesso

### Requirement: Gravar e remover a chave exige permissão própria

Gravar ou remover a chave Pix SHALL exigir a permissão `billing.edit`, concedida apenas ao papel
`admin`. A permissão SHALL ser checada na action, no servidor, e uma requisição sem ela SHALL ser
recusada sem alterar nada — mesmo que tenha chegado por fora da tela.

Para quem não tem `billing.edit`, a tela SHALL exibir tipo e valor da chave em modo de leitura,
marcados como "Somente leitura", sem botão de salvar nem de remover.

#### Scenario: Operador vê, não altera

- **WHEN** um usuário com `content.edit` e sem `billing.edit` abre a aba Cobrança
- **THEN** a chave aparece em leitura, com selo "Somente leitura", e não há botão de salvar nem de
  remover na tela

#### Scenario: Requisição forjada é recusada no servidor

- **WHEN** um usuário sem `billing.edit` envia uma requisição direta para a action de gravação
- **THEN** a chave cadastrada permanece inalterada e a resposta informa a falta de permissão

### Requirement: A chave é validada por tipo antes de gravar

O servidor SHALL validar o valor da chave conforme o tipo escolhido, e SHALL recusar a gravação
quando o formato não confere, com a mensagem no campo do valor:

- CPF: onze dígitos com dígitos verificadores válidos
- CNPJ: quatorze dígitos com dígitos verificadores válidos
- e-mail: endereço de e-mail válido
- telefone: código do país, DDD e número, com oito ou nove dígitos
- chave aleatória: identificador no formato que o Banco Central emite (UUID)

A gravação recusada NÃO SHALL alterar a chave cadastrada: a chave anterior continua valendo até a
nova gravar. Um envio recusado SHALL devolver ao formulário o tipo e o valor digitados.

A chave gravada SHALL ser normalizada — somente dígitos para CPF, CNPJ e telefone, minúsculas para
e-mail e para a chave aleatória — de modo que o valor guardado independa da formatação digitada.

#### Scenario: Valor não confere com o tipo

- **WHEN** o tipo é "E-mail" e o valor enviado é `financeiro.serventia`
- **THEN** nada é gravado, o campo do valor exibe a mensagem de erro, e a chave anterior continua
  valendo

#### Scenario: CPF com dígito verificador errado

- **WHEN** o tipo é "CPF" e o valor tem onze dígitos com verificador inválido
- **THEN** a gravação é recusada com erro no campo do valor

#### Scenario: Formatação digitada não muda o que é guardado

- **WHEN** o tipo é "CNPJ" e o valor é digitado com pontos, barra e traço
- **THEN** o que fica gravado são apenas os quatorze dígitos

#### Scenario: Tipo fora da lista é recusado

- **WHEN** uma requisição envia um tipo de chave que não está entre os cinco aceitos
- **THEN** nada é gravado

### Requirement: Remover a chave é ação explícita

Remover a chave SHALL ser uma ação própria, e NÃO SHALL ser feita gravando o campo do valor em
branco. Após a remoção, a serventia SHALL voltar ao estado "sem chave cadastrada".

#### Scenario: Remoção deixa a serventia sem chave

- **WHEN** um usuário com `billing.edit` aciona "Remover chave"
- **THEN** a serventia passa a não ter chave cadastrada e a tela mostra o estado sem chave

#### Scenario: Campo em branco não é remoção

- **WHEN** o formulário é enviado com o valor da chave em branco
- **THEN** a gravação é recusada com erro no campo, e a chave anterior continua cadastrada

### Requirement: Cobrança é por serventia e deixa rastro

A chave SHALL ser gravada como override daquela serventia e NÃO SHALL alcançar nenhuma outra. Toda
gravação e toda remoção SHALL registrar entrada em `audit_log` com o autor, a ação e a serventia.

#### Scenario: Chave é por serventia

- **WHEN** a serventia A cadastra uma chave
- **THEN** a serventia B continua sem chave, ou com a própria, inalterada

#### Scenario: Remoção também deixa rastro

- **WHEN** uma chave é removida
- **THEN** existe uma linha em `audit_log` identificando quem removeu, em qual serventia e quando

#### Scenario: Override corrompido é ignorado

- **WHEN** a linha de override da chave Pix está gravada com conteúdo que não valida
- **THEN** a serventia é lida como se não tivesse chave cadastrada, e as demais abas continuam com
  seus próprios overrides valendo
