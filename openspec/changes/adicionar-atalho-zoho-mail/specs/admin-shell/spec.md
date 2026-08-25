## MODIFIED Requirements

### Requirement: Navegação só oferece o que existe e o que a pessoa pode acessar

A navegação da sidebar SHALL listar apenas rotas do painel que existem no aplicativo, agrupadas
sob rótulos de seção. Um item cuja rota exija permissão que o papel da sessão não tem SHALL ser
omitido. A omissão do item NÃO SHALL ser tratada como controle de acesso: a rota correspondente
SHALL checar a permissão no servidor de qualquer forma.

A navegação SHALL admitir também item declarado como externo, cujo destino é uma ferramenta fora
do aplicativo. Item externo SHALL ser declarado explicitamente como tal e SHALL:

- abrir em aba nomeada e reutilizada, de modo que cliques repetidos voltem à mesma aba em vez de
  abrir uma nova a cada vez, e carregar `rel="noreferrer"`;
- exibir sinal visual de saída do painel, no mesmo espaço em que um item interno exibe seu
  contador de pendências;
- nunca ser marcado como página atual, já que nenhuma rota do painel corresponde a ele.

A regra de listar só o que existe continua valendo com o mesmo sentido: um item externo aponta
para ferramenta em uso pela serventia, nunca para destino inexistente ou não contratado.

#### Scenario: Item da tela atual em destaque

- **WHEN** o usuário está em `/admin/configuracoes`
- **THEN** o item "Configurações" aparece marcado como página atual (`aria-current="page"`) e os
  demais não

#### Scenario: Rota inexistente não vira item de menu

- **WHEN** a sidebar é renderizada e a tela "Pedidos de serviço" ainda não existe no aplicativo
- **THEN** nenhum item de menu aponta para ela

#### Scenario: Esconder o item não substitui a checagem

- **WHEN** um usuário com papel `staff` navega diretamente para uma rota que exige `user.manage`,
  sem o item correspondente na sidebar
- **THEN** a própria rota recusa o acesso no servidor

#### Scenario: Item externo abre fora do painel sem multiplicar abas

- **WHEN** o usuário aciona o item "Zoho Mail" e depois volta ao painel e o aciona de novo
- **THEN** o destino abre fora do painel nas duas vezes, na mesma aba nomeada, e a aba do painel
  permanece onde estava

#### Scenario: Item externo se anuncia como externo

- **WHEN** a sidebar renderiza um item declarado como externo
- **THEN** o item exibe o sinal de saída do painel no lugar onde um item interno exibiria seu
  contador

#### Scenario: Item externo nunca é a página atual

- **WHEN** o usuário está em qualquer tela do painel
- **THEN** nenhum item externo aparece marcado com `aria-current="page"`

## ADDED Requirements

### Requirement: Atalho para a caixa institucional no Zoho Mail

A sidebar SHALL oferecer o item "Zoho Mail", no grupo "Operação", posicionado imediatamente após
"Pedidos de serviço", apontando para o webmail do Zoho. O endereço SHALL ser o mesmo para todas
as serventias, declarado no código, e NÃO SHALL ser configurável por serventia enquanto não
houver variação real entre elas.

O item SHALL usar ícone próprio de correspondência, distinto do ícone de "Pedidos de serviço".

O item NÃO SHALL exigir permissão do painel: o acesso à caixa é decidido pelo login do próprio
Zoho, que o Veridia não intermedia nem antecipa. O Veridia NÃO SHALL armazenar credenciais do
Zoho nem tentar estabelecer sessão no webmail em nome do usuário.

#### Scenario: Atalho presente para quem tem acesso ao painel

- **WHEN** um usuário com papel `staff` abre qualquer tela do painel
- **THEN** a sidebar mostra "Zoho Mail" no grupo "Operação", logo abaixo de "Pedidos de serviço"

#### Scenario: Mesmo destino em qualquer serventia

- **WHEN** o painel é aberto em duas serventias diferentes
- **THEN** o item "Zoho Mail" aponta para o mesmo endereço nas duas

#### Scenario: Ícone não se confunde com o da fila de pedidos

- **WHEN** a sidebar renderiza "Pedidos de serviço" e "Zoho Mail" em sequência
- **THEN** os dois itens exibem ícones distintos

#### Scenario: Nenhuma credencial do Zoho trafega pelo painel

- **WHEN** o usuário aciona "Zoho Mail"
- **THEN** o painel apenas o leva ao endereço do webmail, sem enviar identificação, token ou
  senha, e a autenticação acontece inteiramente no Zoho
