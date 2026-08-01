## ADDED Requirements

### Requirement: Configuracao da serventia como codigo versionado

O sistema DEVE (SHALL) representar cada serventia como um registro de configuracao versionado no
codebase, validado por schema, sem exigir banco de dados nem interface de administracao. A
configuracao DEVE (SHALL) conter identificacao (nome, subtitulo, CNS), atribuicoes, contatos,
horario de atendimento, titular, encarregado de dados, aliquota de ISS, logos, rodape legal e
override de secoes.

#### Scenario: Config valida e aceita

- **WHEN** uma configuracao de serventia com todos os campos obrigatorios e carregada
- **THEN** o schema a valida e expoe um objeto tipado

#### Scenario: Config invalida e rejeitada no carregamento

- **WHEN** uma configuracao sem campo obrigatorio e carregada
- **THEN** a validacao falha com erro explicito e a serventia nao sobe com config quebrada

#### Scenario: Duas serventias registradas desde o inicio

- **WHEN** o registro de serventias e carregado
- **THEN** existem ao menos duas, com conjuntos de atribuicoes diferentes entre si

### Requirement: Resolucao da serventia por host

O sistema DEVE (SHALL) resolver qual serventia servir a partir do host da requisicao, com fallback
para a serventia definida em variavel de ambiente. A resolucao DEVE (SHALL) ignorar diferenca de
caixa, porta e prefixo `www`. Nenhuma serventia DEVE (SHALL) ver dados de outra.

#### Scenario: Host mapeado resolve a serventia

- **WHEN** uma requisicao chega por um host mapeado a uma serventia
- **THEN** o sistema usa a configuracao daquela serventia

#### Scenario: Host normalizado ainda resolve

- **WHEN** o host chega em caixa alta, com `www` ou com porta explicita
- **THEN** o sistema resolve a mesma serventia

#### Scenario: Host desconhecido usa a serventia padrao

- **WHEN** uma requisicao chega por host nao mapeado
- **THEN** o sistema usa a serventia padrao da variavel de ambiente

#### Scenario: Fallback quebrado falha alto

- **WHEN** o host nao e de ninguem e a serventia padrao configurada nao existe
- **THEN** o sistema lanca erro, em vez de servir a serventia errada em silencio

### Requirement: Gating de secoes por atribuicao legal

O sistema DEVE (SHALL) derivar quais secoes ficam disponiveis a partir das atribuicoes da serventia,
por uma funcao unica de verdade consumida pela navegacao e pelas rotas. Override explicito na config
DEVE (SHALL) poder desligar uma secao mesmo quando a atribuicao existe. NAO DEVE (SHALL NOT) existir
camada comercial, plano contratado ou limite numerico por serventia.

#### Scenario: Secao ligada pela atribuicao

- **WHEN** a serventia tem a atribuicao RCPN
- **THEN** a secao de editais fica disponivel e inclui o setor de proclamas

#### Scenario: Secao desligada por ausencia de atribuicao

- **WHEN** a serventia tem apenas a atribuicao NOTAS
- **THEN** a secao de editais nao fica disponivel nem aparece na navegacao

#### Scenario: Secoes institucionais sempre ligadas

- **WHEN** qualquer serventia e carregada, independente das atribuicoes
- **THEN** inicio, ouvidoria, transparencia, LGPD, selo e contato ficam disponiveis

#### Scenario: Override explicito desliga secao

- **WHEN** a config declara override desligando uma secao cuja atribuicao existe
- **THEN** a secao fica indisponivel

### Requirement: Nucleo de dominio sem framework

O nucleo de dominio DEVE (SHALL) ser puro: sem import de framework de UI, cliente de banco ou
qualquer I/O, e DEVE (SHALL) ser testavel sem servidor, sem banco e sem navegador. A restricao DEVE
(SHALL) ser verificada automaticamente.

#### Scenario: Import proibido barra o merge

- **WHEN** um arquivo do nucleo importa framework de UI ou cliente de banco
- **THEN** a verificacao falha e o merge e barrado
