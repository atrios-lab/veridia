## ADDED Requirements

### Requirement: Flag decide o destino dos pontos de entrada de consulta
Uma feature flag avaliada no servidor SHALL decidir para qual rota os pontos de entrada de consulta que o próprio site controla (link "Consultar protocolo" no cabeçalho, link equivalente no rodapé, e qualquer CTA de acompanhamento na home) apontam: `/protocolo` quando desligada, `/acompanhar` quando ligada. Todos os pontos de entrada SHALL ler a flag por um único helper compartilhado, nunca cada um por conta própria.

#### Scenario: Flag desligada mantém o comportamento atual
- **WHEN** a flag está desligada (valor padrão)
- **THEN** o link "Consultar protocolo" do cabeçalho, o do rodapé e o CTA da home apontam para `/protocolo`

#### Scenario: Flag ligada aponta para a nova experiência
- **WHEN** a flag está ligada
- **THEN** o link "Consultar protocolo" do cabeçalho, o do rodapé e o CTA da home apontam para `/acompanhar`

### Requirement: As duas rotas continuam acessíveis por URL direta
A flag SHALL NOT bloquear o acesso direto a nenhuma das duas rotas de consulta. `/protocolo` e `/acompanhar` SHALL continuar respondendo normalmente a quem acessa a URL diretamente, com qualquer valor da flag, protegidas apenas pelo par protocolo + chave que cada uma já exige.

#### Scenario: Acesso direto a /acompanhar com a flag desligada
- **WHEN** um cidadão acessa `/acompanhar` diretamente enquanto a flag está desligada
- **THEN** a página carrega e funciona normalmente, com protocolo + chave

#### Scenario: Acesso direto a /protocolo com a flag ligada
- **WHEN** um cidadão acessa `/protocolo` diretamente enquanto a flag está ligada
- **THEN** a página carrega e funciona normalmente, como fazia antes desta mudança

### Requirement: Avaliação da flag só no servidor
A leitura do valor da flag SHALL ocorrer exclusivamente em Server Components ou Server Actions. Nenhum código de cliente SHALL receber o valor bruto da flag; o único efeito visível ao cliente SHALL ser o `href` já resolvido nos links afetados.

#### Scenario: Nenhum estado de flag exposto ao cliente
- **WHEN** a página é renderizada com a flag em qualquer estado
- **THEN** o HTML e o JavaScript enviados ao navegador não contêm o valor da flag, apenas o link já resolvido

### Requirement: Fallback seguro quando a flag não pode ser lida
Se o armazenamento da flag (Edge Config) estiver inacessível, mal configurado, ou a leitura falhar por qualquer motivo, o sistema SHALL usar o valor padrão da flag (desligada), preservando o comportamento anterior a esta mudança. Uma falha de leitura da flag NÃO SHALL derrubar a renderização da página nem propagar erro ao cidadão.

#### Scenario: Armazenamento da flag indisponível
- **WHEN** o Edge Config está inacessível no momento da renderização
- **THEN** os pontos de entrada de consulta apontam para `/protocolo`, e a página renderiza normalmente

### Requirement: Ambiente local e CI funcionam sem configuração adicional
Em ambientes sem o armazenamento da flag configurado (desenvolvimento local, CI), o sistema SHALL usar o valor padrão da flag sem exigir nenhuma variável de ambiente nova. Testes automatizados SHALL poder forçar um valor específico da flag por override, sem depender de um armazenamento real configurado.

#### Scenario: Desenvolvimento local sem configuração de flag
- **WHEN** o site roda localmente sem a variável de conexão do Edge Config definida
- **THEN** o comportamento é o padrão (flag desligada), sem erro de configuração

#### Scenario: Teste automatizado força a flag ligada
- **WHEN** um teste end-to-end define um override para ligar a flag
- **THEN** os pontos de entrada de consulta apontam para `/acompanhar` apenas naquele teste, sem afetar outras execuções
