## MODIFIED Requirements

### Requirement: Lista de contas com papel e status

Em `/admin/usuarios`, o sistema SHALL listar as contas do painel da serventia da sessão, cada
uma com nome, e-mail, papel em português ("Registrador" ou "Operador") e um selo de status:
"Ativa" quando a conta já tem senha própria definida e o acesso não está desativado, "Aguardando
1º acesso" quando ainda não tem senha própria e o acesso não está desativado, ou "Acesso
desativado" quando o acesso foi desativado, independentemente de a conta já ter senha própria ou
não.

#### Scenario: Conta que ainda não criou senha
- **WHEN** a lista de Usuários é aberta e uma conta nunca completou a criação da própria senha e
  não está desativada
- **THEN** essa linha mostra o selo "Aguardando 1º acesso"

#### Scenario: Conta com senha já criada
- **WHEN** a lista de Usuários é aberta e uma conta já criou a própria senha ao menos uma vez e
  não está desativada
- **THEN** essa linha mostra o selo "Ativa"

#### Scenario: Conta com acesso desativado
- **WHEN** a lista de Usuários é aberta e uma conta teve o acesso desativado
- **THEN** essa linha mostra o selo "Acesso desativado", mesmo que a conta já tenha senha
  própria definida

## ADDED Requirements

### Requirement: Desativar acesso de uma conta

O sistema SHALL oferecer a ação "Desativar acesso" para uma conta que não é a da própria sessão
e não é a última conta com papel Registrador ainda com acesso ativo na serventia. Ao ser
acionada, ela marca a conta como desativada, encerra imediatamente toda sessão ativa dessa conta
e passa a recusar login para ela até que seja reativada. A senha existente da conta SHALL
permanecer inalterada.

#### Scenario: Registrador desativa o acesso de um operador que saiu
- **WHEN** o registrador aciona "Desativar acesso" para uma conta de Operador
- **THEN** o sistema marca a conta como desativada, encerra qualquer sessão ativa dela, o selo
  passa a "Acesso desativado" e um login subsequente com aquela conta é recusado

#### Scenario: Conta desativada tenta continuar navegando no painel
- **WHEN** uma conta é desativada enquanto tem uma sessão aberta em outra aba
- **THEN** a próxima requisição dessa sessão ao painel é recusada como se não houvesse sessão

### Requirement: Reativar acesso de uma conta

Para uma conta com acesso desativado, o sistema SHALL oferecer a ação "Reativar acesso", que
restaura o acesso sem exigir nem permitir que uma nova senha seja definida no processo — a senha
que a conta já tinha antes de ser desativada volta a valer.

#### Scenario: Registrador reativa uma conta
- **WHEN** o registrador aciona "Reativar acesso" para uma conta com o selo "Acesso desativado"
- **THEN** o sistema remove a marca de desativação, a conta volta a poder logar com a senha que
  já tinha, e o selo volta a refletir "Ativa" ou "Aguardando 1º acesso" conforme o estado da
  senha

### Requirement: Proteção — não é possível desativar a própria conta

O sistema SHALL recusar desativar a conta da própria sessão, tanto ocultando/desabilitando a
ação "Desativar acesso" na própria linha quanto recusando a operação no servidor caso seja
acionada de qualquer forma.

#### Scenario: Registrador tenta desativar a própria conta pela UI
- **WHEN** a lista de Usuários é renderizada para a própria conta da sessão
- **THEN** a linha da própria conta não oferece a ação "Desativar acesso"

#### Scenario: Requisição forjada tenta desativar a própria conta
- **WHEN** uma requisição de desativação é enviada com o `userId` da própria conta da sessão,
  contornando a UI
- **THEN** o sistema recusa a operação e a conta permanece com o acesso ativo

### Requirement: Proteção — não é possível desativar a última conta Registrador ativa

O sistema SHALL recusar desativar uma conta com papel Registrador quando, após a operação,
nenhuma outra conta com papel Registrador e acesso ativo restaria na serventia. Contas com papel
Operador nunca disparam essa proteção.

#### Scenario: Serventia com um único Registrador ativo
- **WHEN** o registrador aciona "Desativar acesso" para a única conta Registrador com acesso
  ativo da serventia (a própria ou outra)
- **THEN** o sistema recusa a operação, informa que é preciso manter ao menos um Registrador
  ativo, e a conta permanece com o acesso ativo

#### Scenario: Serventia com dois Registradores ativos
- **WHEN** o registrador aciona "Desativar acesso" para uma conta Registrador e existe pelo
  menos outra conta Registrador com acesso ativo na serventia
- **THEN** o sistema desativa a conta normalmente

#### Scenario: Desativar um Operador nunca é bloqueado por essa proteção
- **WHEN** o registrador aciona "Desativar acesso" para uma conta com papel Operador
- **THEN** o sistema não aplica a checagem de última conta Registrador, pois ela só vale para
  contas com papel Registrador
