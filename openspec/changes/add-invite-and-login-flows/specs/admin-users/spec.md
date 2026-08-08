## ADDED Requirements

### Requirement: Lista de contas com papel e status

Em `/admin/usuarios`, o sistema SHALL listar as contas do painel da serventia da sessão, cada
uma com nome, e-mail, papel em português ("Registrador" ou "Operador") e um selo de status:
"Ativa" quando a conta já tem senha própria definida, "Aguardando 1º acesso" quando ainda não.

#### Scenario: Conta que ainda não criou senha
- **WHEN** a lista de Usuários é aberta e uma conta nunca completou a criação da própria senha
- **THEN** essa linha mostra o selo "Aguardando 1º acesso"

#### Scenario: Conta com senha já criada
- **WHEN** a lista de Usuários é aberta e uma conta já criou a própria senha ao menos uma vez
- **THEN** essa linha mostra o selo "Ativa"

### Requirement: Criar conta sem definir senha

O sistema SHALL permitir que o registrador crie uma conta informando apenas nome, e-mail e papel
(Operador ou Registrador). O formulário NÃO SHALL conter campo de senha. Ao confirmar, o sistema
SHALL exibir uma confirmação de que o e-mail de convite foi enviado.

#### Scenario: Registrador cria conta com sucesso
- **WHEN** o registrador envia o formulário "Criar conta" com nome, e-mail e papel válidos
- **THEN** o sistema cria a conta sem senha, dispara o convite de primeiro acesso e mostra a
  confirmação "Conta criada — e-mail enviado"

#### Scenario: E-mail já usado por outra conta
- **WHEN** o registrador envia o formulário "Criar conta" com um e-mail que já pertence a outra
  conta (o e-mail é único na plataforma, não só dentro da serventia)
- **THEN** o sistema recusa a criação e mostra que aquele e-mail já está em uso, sem criar conta
  duplicada

### Requirement: Reenviar convite invalida o anterior

Para uma conta em "Aguardando 1º acesso", o sistema SHALL oferecer a ação "Reenviar convite",
que emite um novo link de primeiro acesso válido por 48 horas e invalida qualquer link de
convite emitido anteriormente para aquela conta.

#### Scenario: Reenviar convite vencido
- **WHEN** o registrador aciona "Reenviar convite" para uma conta "Aguardando 1º acesso"
- **THEN** o sistema invalida o link anterior, emite um novo com 48 horas de validade e envia um
  novo e-mail de convite para a mesma conta

### Requirement: Disparar nova senha sem ver nem definir a senha

Para uma conta "Ativa", o sistema SHALL oferecer a ação "Nova senha", que emite um link de nova
senha válido por 48 horas e invalida qualquer link de redefinição pendente, sem em nenhum
momento mostrar ou permitir que o registrador digite a senha da outra pessoa. A conta SHALL
permanecer ativa e a senha atual SHALL continuar válida até a nova ser criada.

#### Scenario: Registrador aciona Nova senha
- **WHEN** o registrador aciona "Nova senha" para uma conta "Ativa"
- **THEN** o sistema emite um novo link de 48 horas, invalida qualquer link de redefinição
  pendente daquela conta, envia o e-mail de nova senha, e a conta continua "Ativa" com a senha
  atual funcionando normalmente até a pessoa criar a nova

### Requirement: Acesso restrito a quem administra contas

O sistema SHALL exigir a permissão `user.manage` para acessar `/admin/usuarios` e para acionar
qualquer uma de suas ações, verificada no servidor independentemente do item existir na sidebar
da sessão.

#### Scenario: Sessão sem permissão de gestão de usuários
- **WHEN** uma sessão sem `user.manage` (papel Operador) acessa diretamente `/admin/usuarios`
- **THEN** o sistema recusa o acesso, mesmo sem o item aparecer na sidebar dessa sessão
