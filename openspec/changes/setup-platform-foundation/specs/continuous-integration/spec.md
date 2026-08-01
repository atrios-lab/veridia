## ADDED Requirements

### Requirement: Verificacao antes do merge

O repositorio DEVE (SHALL) rodar verificacao automatica em todo pull request, cobrindo instalacao
com lockfile exato, checagem de tipos, lint, testes, build da aplicacao, os checks de convencao e a
validacao das specs. Merge com verificacao vermelha NAO DEVE (SHALL NOT) ser feito.

#### Scenario: Pull request roda a verificacao completa

- **WHEN** um pull request e aberto ou atualizado
- **THEN** tipos, lint, testes, build, checks de convencao e validacao de specs executam

#### Scenario: Instalacao nao resolve versao nova sozinha

- **WHEN** as dependencias sao instaladas na verificacao
- **THEN** a instalacao respeita exatamente o lockfile, para o resultado nao variar sem ninguem mexer

#### Scenario: Commit novo cancela execucao anterior

- **WHEN** um novo commit chega no mesmo pull request
- **THEN** a execucao anterior e cancelada

### Requirement: Verificacao sem segredo

A verificacao NAO DEVE (SHALL NOT) receber credencial alguma. Os testes DEVEM (SHALL) rodar sem
banco real, sem servico externo e sem token.

#### Scenario: Testes rodam sem banco

- **WHEN** a verificacao executa os testes
- **THEN** eles passam sem nenhuma variavel de ambiente sensivel configurada

### Requirement: Teste de ponta a ponta multi-tenant

A verificacao DEVE (SHALL) incluir teste de ponta a ponta parametrizado sobre as serventias
registradas, afirmando **estrutura**: que cada host devolve a serventia certa e exatamente as secoes
esperadas pelo gating. Asercao visual NAO DEVE (SHALL NOT) fazer parte desta entrega.

#### Scenario: Hosts diferentes devolvem serventias diferentes

- **WHEN** o teste de ponta a ponta visita a aplicacao por dois hosts distintos
- **THEN** cada resposta traz o nome da serventia correspondente

#### Scenario: Navegacao reflete o gating

- **WHEN** o teste visita a serventia que possui apenas a atribuicao NOTAS
- **THEN** a secao de editais nao aparece

#### Scenario: Serventia nova entra no teste sem codigo novo

- **WHEN** uma serventia e adicionada ao registro
- **THEN** ela passa a ser coberta pelo teste parametrizado sem escrever novo caso

### Requirement: Convencoes verificadas por script

A verificacao DEVE (SHALL) barrar automaticamente as convencoes do produto: texto visivel sem
travessao nem meia-risca, e nenhuma cor hexadecimal literal fora do bloco de tokens do tema.

#### Scenario: Travessao em texto visivel barra o merge

- **WHEN** um texto visivel ao usuario contem travessao ou meia-risca
- **THEN** a verificacao falha

#### Scenario: Hex fora dos tokens barra o merge

- **WHEN** uma cor hexadecimal literal aparece fora do bloco de tokens do tema
- **THEN** a verificacao falha
