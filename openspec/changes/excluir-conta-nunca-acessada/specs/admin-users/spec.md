## ADDED Requirements

### Requirement: Excluir conta que nunca acessou

O sistema SHALL oferecer a ação "Excluir conta" apenas para conta da serventia da sessão que
nunca criou a própria senha, ou seja, que nunca acessou o painel. A ação SHALL exigir a permissão
`user.manage`, SHALL apagar a conta em definitivo e SHALL liberar o e-mail dela para um novo
convite. A exclusão SHALL ser confirmada em um diálogo que declare que a conta nunca foi
acessada e que a operação não pode ser desfeita.

#### Scenario: Conta convidada por engano é excluída
- **WHEN** o registrador aciona "Excluir conta" para uma conta com o selo "Aguardando 1º acesso"
  e confirma no diálogo
- **THEN** a conta some da lista de contas do painel

#### Scenario: O e-mail volta a ficar disponível
- **WHEN** uma conta é excluída e o registrador cria uma conta nova com o mesmo e-mail
- **THEN** a criação é aceita, sem o erro de e-mail já cadastrado

#### Scenario: Sessões e credenciais da conta não sobrevivem
- **WHEN** uma conta é excluída
- **THEN** nada mais no sistema aceita aquela conta como identidade de acesso

### Requirement: Excluir invalida o convite em aberto

Ao excluir uma conta, o sistema SHALL invalidar qualquer convite ou link de nova senha ainda em
aberto emitido para ela.

#### Scenario: Convite pendente deixa de valer
- **WHEN** uma conta com convite em aberto é excluída e alguém abre o link daquele convite
- **THEN** a tela informa que o link não vale mais, e nenhuma senha é criada

### Requirement: Proteção — conta que já acessou não pode ser excluída

O sistema SHALL recusar a exclusão de conta que já criou a própria senha, mesmo quando o acesso
dela está desativado. Para essa conta o sistema SHALL oferecer apenas "Desativar acesso", e a
recusa SHALL ser aplicada no servidor, não apenas escondendo a ação na tela.

#### Scenario: Conta ativa não oferece exclusão
- **WHEN** a lista de contas é aberta e uma conta já acessou o painel ao menos uma vez
- **THEN** a linha dessa conta não oferece "Excluir conta"

#### Scenario: Submissão forjada para conta com histórico
- **WHEN** chega uma submissão de exclusão apontando para uma conta que já criou a própria senha
- **THEN** o sistema recusa a operação e a conta continua na lista, com o histórico dela intacto

#### Scenario: Pessoa aceita o convite enquanto o diálogo está aberto
- **WHEN** o registrador confirma a exclusão de uma conta que, entre a abertura do diálogo e a
  confirmação, passou a ter senha própria
- **THEN** o sistema recusa a exclusão e a lista passa a mostrar aquela conta como "Ativa"

#### Scenario: Conta de outra serventia
- **WHEN** chega uma submissão de exclusão apontando para uma conta que não pertence à serventia
  da sessão
- **THEN** o sistema recusa a operação sem apagar nada

### Requirement: Registro da exclusão na auditoria

O sistema SHALL registrar cada exclusão de conta na auditoria da serventia, identificando quem
excluiu e qual conta foi excluída. O registro SHALL permanecer legível depois que a conta deixa
de existir.

#### Scenario: Auditoria sobrevive à conta
- **WHEN** uma conta é excluída
- **THEN** a trilha de auditoria da serventia guarda a exclusão, com o autor e a conta alvo,
  mesmo não havendo mais a conta para consultar
