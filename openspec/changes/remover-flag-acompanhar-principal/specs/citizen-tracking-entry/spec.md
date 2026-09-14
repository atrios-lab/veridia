## ADDED Requirements

### Requirement: Pontos de entrada do site sempre apontam para /acompanhar
Os pontos de entrada de consulta que o próprio site controla SHALL resolver para `/acompanhar`:
o link "Consultar protocolo" no cabeçalho, no rodapé, no menu do celular, o campo de busca de
protocolo na hero da home, e o link exibido após o envio de um pedido de serviço. Nenhum desses
pontos de entrada SHALL depender de flag, variável de ambiente ou qualquer outra forma de
alternância em runtime para decidir esse destino.

#### Scenario: Campo de busca da home aponta para /acompanhar
- **WHEN** a home renderiza o campo de busca de protocolo na hero
- **THEN** o formulário submete para `/acompanhar`

#### Scenario: Cabeçalho, rodapé e menu apontam para /acompanhar
- **WHEN** o cabeçalho, o rodapé ou o menu do celular renderizam o link da seção de consulta de
  protocolo
- **THEN** o `href` desse link é `/acompanhar`

#### Scenario: Link pós-solicitação aponta para /acompanhar
- **WHEN** o cidadão conclui o envio de um pedido de serviço em `/solicitar`
- **THEN** o link "já tenho protocolo" (ou equivalente) exibido aponta para `/acompanhar`

### Requirement: /protocolo continua acessível por URL direta
`/protocolo` SHALL continuar respondendo normalmente a quem acessa a URL diretamente, mesmo não
aparecendo mais em nenhum menu ou link do próprio site. O acesso direto NÃO SHALL ser bloqueado,
redirecionado ou substituído por página de erro nesta mudança.

#### Scenario: Acesso direto a /protocolo
- **WHEN** um cidadão acessa `/protocolo` diretamente por um link salvo ou digitado
- **THEN** a página carrega e funciona normalmente, com protocolo + chave, como antes desta
  mudança

### Requirement: Nenhum mecanismo de flag decide o destino da consulta
Não SHALL existir, no código ou na configuração do projeto, nenhuma feature flag, variável de
ambiente ou serviço externo que controle para qual rota os pontos de entrada de consulta
apontam. A escolha SHALL ser fixa no código.

#### Scenario: Ausência de flag na leitura do destino
- **WHEN** qualquer ponto de entrada de consulta resolve seu `href`
- **THEN** a resolução não envolve leitura de flag, cookie de override, Edge Config ou serviço de
  feature flags — apenas a constante de rota da seção `consulta-protocolo`
