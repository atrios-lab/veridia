## ADDED Requirements

### Requirement: Aba Encarregado com edição do DPO

A rota `/admin/configuracoes/encarregado` SHALL exigir sessão válida na serventia do host e a
permissão `content.edit`, checadas no servidor, e SHALL recusar o acesso de quem chegar por URL
direta sem a permissão. A tela SHALL apresentar a mesma faixa de abas das demais telas de
Configurações, com Encarregado selecionada.

O formulário SHALL ter dois campos, ambos obrigatórios: nome do Encarregado e e-mail de contato.
A tela SHALL declarar que o contato aparece publicamente na área LGPD do site por exigência do
art. 41, §3º da Lei 13.709/2018.

#### Scenario: Aba abre com os valores em vigor

- **WHEN** um usuário com `content.edit` abre `/admin/configuracoes/encarregado`
- **THEN** os campos vêm preenchidos com o nome e o e-mail do Encarregado em vigor para aquela
  serventia — o override gravado, se houver, e a configuração em código se não houver

#### Scenario: Acesso sem permissão

- **WHEN** um usuário autenticado sem `content.edit` requisita `/admin/configuracoes/encarregado`
- **THEN** o servidor recusa o acesso

### Requirement: Validação do contato do Encarregado no servidor

A gravação SHALL ser validada no servidor com o mesmo schema que descreve `dpo` no `TenantSchema`.
Nome vazio e e-mail em formato inválido SHALL ser recusados, com a mensagem no campo
correspondente. Uma gravação recusada NÃO SHALL alterar nada: o contato anterior continua
publicado.

Um envio recusado SHALL devolver ao formulário os valores digitados, para que o usuário não perca
o campo correto ao corrigir o outro.

#### Scenario: E-mail inválido é recusado

- **WHEN** o formulário é enviado com `dpo.serventia` no campo de e-mail
- **THEN** nada é gravado, o campo de e-mail exibe a mensagem de erro, e o contato anterior
  continua publicado no site

#### Scenario: Nome em branco é recusado

- **WHEN** o formulário é enviado com o nome vazio e o e-mail válido
- **THEN** nada é gravado e o campo de nome exibe erro; o e-mail digitado permanece no formulário

#### Scenario: Forjar o envio não alcança outros dados

- **WHEN** uma requisição para a action inclui campos de nome da serventia, CNS, atribuições ou
  chave Pix
- **THEN** eles são ignorados e apenas nome e e-mail do Encarregado são considerados

### Requirement: Gravação do Encarregado é override por serventia e deixa rastro

Uma gravação bem-sucedida SHALL persistir nome e e-mail como override daquela serventia, SHALL ser
visível de imediato no site público sem passo de publicação, e SHALL registrar entrada em
`audit_log` com o autor, a ação e a serventia.

Sem override gravado, o site SHALL exibir o Encarregado do arquivo de configuração da serventia.

#### Scenario: Gravação válida chega ao site

- **WHEN** o usuário grava um Encarregado novo e um visitante abre a página LGPD
- **THEN** o nome e o e-mail exibidos são os que acabaram de ser gravados, sem passo de publicação

#### Scenario: Override é por serventia

- **WHEN** a serventia A grava um Encarregado novo
- **THEN** a serventia B continua exibindo o próprio Encarregado, inalterado

#### Scenario: Toda gravação deixa rastro

- **WHEN** uma gravação é aceita
- **THEN** existe uma linha em `audit_log` identificando quem gravou, em qual serventia e quando

#### Scenario: Override corrompido não derruba a página

- **WHEN** a linha de override do Encarregado está gravada com conteúdo que não valida
- **THEN** a página LGPD é servida com o Encarregado da configuração em código, e as demais abas
  de Configurações continuam com seus próprios overrides valendo
